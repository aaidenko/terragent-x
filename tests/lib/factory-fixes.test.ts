// Unit tests for the loop-5qduspr factory fixes (vitest). Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

import { alertToSignal, floodKind, parseVtec, type NwsAlertFeature } from "../src/lib/alerts";
import { checkContact, isVerifiedContact } from "../src/lib/contacts";
import { buildFloodBrief } from "../src/lib/flood-brief";
import { geometryCentroid, pointInGeometry } from "../src/lib/geo";
import {
  NAMED_GAUGE_SIGNALS,
  gaugeToSignal,
  lidForSignal,
  linkGaugesToWarning,
  parseNwpsGauge,
  warnedRiverPoints,
  type NwpsGaugeJson,
} from "../src/lib/nwps";
import { draftOutreach, matchProspects } from "../src/lib/outreach";
import { clipText } from "../src/lib/text";

// Real NWPS / NWS payloads captured 2026-11-19 (trimmed), not invented values.
const gauges = JSON.parse(
  readFileSync(new URL("./fixtures/nwps-gauges-2026-11-19.json", import.meta.url), "utf8"),
) as Record<string, NwpsGaugeJson>;
const alerts = JSON.parse(
  readFileSync(new URL("./fixtures/nws-fl-alerts-2026-11-19.json", import.meta.url), "utf8"),
) as { features: NwsAlertFeature[] };
const vtecOf = (f: NwsAlertFeature) => f.properties?.parameters?.VTEC?.[0] ?? "";
const riverCocoa = alerts.features.find((f) => vtecOf(f).includes(".FL.W.0006."))!;
const rainfallWarning = alerts.features.find((f) => vtecOf(f).includes(".FA.W."))!;
const floodWatch = alerts.features.find((f) => vtecOf(f).includes(".FA.A."))!;

describe("bug 1: Cocoa gauge mapping", () => {
  it("flood-cocoa-stjohns resolves to NWPS COCF1 / USGS 02232400", () => {
    assert.equal(lidForSignal("flood-cocoa-stjohns"), "COCF1");
    assert.equal(NAMED_GAUGE_SIGNALS["flood-cocoa-stjohns"].expectedUsgsId, "02232400");
    const g = parseNwpsGauge(gauges.COCF1)!;
    assert.equal(g.lid, "COCF1");
    assert.equal(g.usgsId, "02232400");
    assert.match(g.name, /Cocoa/);
    const sig = gaugeToSignal(g, { id: "flood-cocoa-stjohns" })!;
    assert.equal(sig.metrics?.site, "COCF1");
    assert.equal(sig.metrics?.usgsId, "02232400");
    assert.ok(!JSON.stringify(sig).includes("02232000"), "must not reference Melbourne gauge");
  });

  it("reads stage + thresholds from NWPS status/flood (not hardcoded)", () => {
    const g = parseNwpsGauge(gauges.COCF1)!;
    const raw = gauges.COCF1;
    assert.equal(g.observed?.stageFt, raw.status?.observed?.primary);
    assert.equal(g.observed?.category, raw.status?.observed?.floodCategory);
    assert.equal(g.thresholds.minor, raw.flood?.categories?.minor?.stage);
    assert.equal(g.thresholds.major, raw.flood?.categories?.major?.stage);
    const maxCrest = Math.max(...(raw.flood?.crests?.historic ?? []).map((c) => c.stage ?? 0));
    assert.equal(g.recordCrest?.stageFt, maxCrest);
  });

  it("treats NWPS -999 sentinels as missing", () => {
    const g = parseNwpsGauge({
      ...gauges.GENF1,
      status: { observed: { primary: -999, validTime: "0001-01-01T00:00:00Z" } },
    })!;
    assert.equal(g.observed, null);
    assert.equal(gaugeToSignal(g), null);
  });

  it("links a river warning to the gauge it names", () => {
    assert.deepEqual(warnedRiverPoints(riverCocoa.properties!.description!), [
      "St Johns River Near Cocoa 9w",
    ]);
    const list = [gauges.COCF1, gauges.GENF1].map((j) => {
      const g = parseNwpsGauge(j)!;
      return { lid: g.lid, name: g.name, lat: g.lat, lon: g.lon };
    });
    // Melbourne gauge (02232000) sits inside the same polygon; name wins.
    list.push({ lid: "MELF1", name: "St. Johns River near Melbourne", lat: 28.0847, lon: -80.752 });
    const lids = linkGaugesToWarning(
      { description: riverCocoa.properties!.description!, geometry: riverCocoa.geometry },
      list,
      pointInGeometry,
    );
    assert.deepEqual(lids, ["COCF1"]);
  });

  it("matches 'Near Above Lake Harney' to GENF1", () => {
    const g = parseNwpsGauge(gauges.GENF1)!;
    const lids = linkGaugesToWarning(
      {
        description:
          "...The Flood Warning continues for the following rivers in Florida...\n\n  St Johns River Near Above Lake Harney affecting Seminole County.\n\n.Heavy rainfall",
        geometry: null,
      },
      [{ lid: g.lid, name: g.name, lat: g.lat, lon: g.lon }],
      pointInGeometry,
    );
    assert.deepEqual(lids, ["GENF1"]);
  });
});

describe("bug 3: no mid-word truncation, no stock sentence", () => {
  it("returns short text unchanged", () => {
    assert.equal(clipText("Flooding is occurring.", 400), "Flooding is occurring.");
  });

  it("never cuts inside a word", () => {
    const text = "The expected rainfall rates will cause flooding of low-lying areas across the county tonight";
    for (let max = 10; max < text.length; max += 7) {
      const out = clipText(text, max);
      assert.ok(out.length <= max, `len ${out.length} > ${max}`);
      const body = out.replace(/\s?…$/, "");
      assert.ok(text.startsWith(body), "must be a prefix");
      const next = text.charAt(body.length);
      assert.ok(next === "" || next === " ", `cut mid-word at ${max}: "${out}"`);
      assert.ok(out.endsWith("…"));
    }
  });

  it("prefers a sentence boundary", () => {
    const out = clipText("First sentence here. Second sentence is much longer than the budget allows", 40);
    assert.equal(out, "First sentence here. …");
  });

  it("flood brief has no canned filler and no mid-word cut", () => {
    const sig = alertToSignal(rainfallWarning, { ...geometryCentroid(rainfallWarning.geometry)!, source: "polygon" });
    const brief = buildFloodBrief(sig, null);
    assert.ok(!brief.finding.includes("Public alert fused with AOI buffer analysis"));
    assert.ok(!brief.finding.includes("outreach-ready"));
    assert.ok(!/\brainfa\b/.test(brief.finding));
  });
});

describe("bug 4: rainfall/flash alerts carry their own data", () => {
  it("parses VTEC and classifies flood kind", () => {
    const v = parseVtec(vtecOf(rainfallWarning))!;
    assert.equal(v.phenomenon, "FA");
    assert.equal(floodKind("Flood Warning", v), "areal");
    assert.equal(floodKind("Flood Warning", parseVtec(vtecOf(riverCocoa))), "river");
    assert.equal(floodKind("Flash Flood Warning", parseVtec("/O.NEW.KMLB.FF.W.0042.261119T2147Z-261120T0000Z/")), "flash");
  });

  it("uses the alert polygon centroid, not 28.4,-80.7", () => {
    const c = geometryCentroid(rainfallWarning.geometry)!;
    assert.ok(pointInGeometry(c.lat, c.lon, rainfallWarning.geometry) || Math.abs(c.lat - 28.5) < 0.3);
    const sig = alertToSignal(rainfallWarning, { ...c, source: "polygon" });
    assert.notDeepEqual([sig.lat, sig.lon], [28.4, -80.7]);
    assert.equal(sig.metrics?.locationSource, "alert_polygon_centroid");
  });

  it("rainfall alert brief shows no stage metrics and claims no gauge comparison", () => {
    const sig = alertToSignal(rainfallWarning, { ...geometryCentroid(rainfallWarning.geometry)!, source: "polygon" });
    const brief = buildFloodBrief(sig, null);
    for (const k of ["stageFt", "floodStageFt", "recordFt", "estimatedWetFraction"]) {
      assert.ok(!(k in brief.metrics), `unexpected ${k}`);
    }
    assert.ok(!brief.method.some((m) => /gauge|stage/i.test(m)), brief.method.join(" | "));
    assert.equal(brief.metrics.dataMode, "alert_only");
    const s = JSON.stringify(brief);
    assert.ok(!s.includes("17.6") && !s.includes('"floodStageFt":16'));
  });

  it("zone-only watch with no location is not pinned to a default", () => {
    assert.equal(floodWatch.geometry, null);
    assert.equal(geometryCentroid(floodWatch.geometry), null);
  });

  it("river warning with a linked gauge claims a comparison that was made", () => {
    const g = gaugeToSignal(parseNwpsGauge(gauges.COCF1)!)!;
    const sig = alertToSignal(
      riverCocoa,
      { ...geometryCentroid(riverCocoa.geometry)!, source: "polygon" },
      { metrics: { linkedGauges: "COCF1", ...g.metrics } },
    );
    const brief = buildFloodBrief(sig, null);
    assert.equal(brief.metrics.gaugeLid, "COCF1");
    assert.equal(brief.metrics.stageFt, gauges.COCF1.status?.observed?.primary);
    assert.ok(brief.method.some((m) => m.includes("NWPS COCF1")));
  });
});

describe("bug 5: placeholder contacts are blocked", () => {
  const bad: Array<["x" | "email", string]> = [
    ["email", "ops@example-lake-poinsett-hoa.test"],
    ["email", "manager@example-silver-pines.test"],
    ["email", "em@example-county.gov.test"],
    ["email", "someone@example.com"],
    ["email", "a@foo.example"],
    ["email", "a@foo.invalid"],
    ["email", "root@localhost"],
    ["email", "x@host.localhost"],
    ["email", "not-an-email"],
    ["email", ""],
    ["x", "@search:Lone Cabbage Fish Camp Cocoa"],
    ["x", "search:Brevard property management"],
    ["x", "@this_handle_is_way_too_long"],
    ["x", "@has space"],
    ["x", ""],
  ];
  for (const [ch, v] of bad) {
    it(`rejects ${ch} "${v}"`, () => assert.equal(isVerifiedContact(ch, v), false));
  }

  it("accepts real-looking contacts", () => {
    assert.ok(checkContact("email", "info@brevardfl.gov").ok);
    assert.ok(checkContact("x", "@NWSMelbourne").ok);
  });

  it("matcher emits needs_contact prospects and closer makes zero drafts", () => {
    const sig = gaugeToSignal(parseNwpsGauge(gauges.COCF1)!, { id: "flood-cocoa-stjohns" })!;
    const brief = { ...buildFloodBrief(sig, null), id: "b", eventId: sig.id, market: sig.market, createdAt: "", mapHint: { lat: 0, lon: 0, label: "" } };
    const prospects = matchProspects(sig, 4);
    assert.ok(prospects.length > 0);
    for (const p of prospects) {
      assert.equal(p.handleOrEmail, "");
      assert.equal(p.contactStatus, "needs_contact");
      assert.equal(draftOutreach(sig, brief, p), null);
    }
    const forced = { ...prospects[0], channel: "email" as const, handleOrEmail: "ops@example-lake-poinsett-hoa.test" };
    assert.equal(draftOutreach(sig, brief, forced), null);
  });
});
