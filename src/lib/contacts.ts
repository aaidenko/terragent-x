/**
 * Contact validation for Matcher/Closer. A draft may only be produced for a
 * real, verifiable contact. Placeholders (reserved TLDs, example domains,
 * "@search:" lookups, localhost, etc.) are rejected. No runtime imports.
 */

/** RFC 2606 / RFC 6761 reserved TLDs plus common local-only suffixes. */
const RESERVED_TLDS = new Set([
  "test",
  "example",
  "invalid",
  "localhost",
  "local",
  "internal",
  "lan",
  "home",
  "corp",
  "localdomain",
]);

/** Second-level names reserved for documentation (example.com etc.). */
const RESERVED_SLDS = new Set(["example"]);

const PLACEHOLDER_LOCAL_PARTS = new Set([
  "test",
  "example",
  "placeholder",
  "noreply",
  "no-reply",
  "nobody",
  "changeme",
  "todo",
  "tbd",
  "foo",
  "user",
]);

export type ContactCheck = { ok: true } | { ok: false; reason: string };

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$/;
/** X/Twitter handle: @ + 1–15 of [A-Za-z0-9_]. */
const X_HANDLE_RE = /^@[A-Za-z0-9_]{1,15}$/;

export function checkEmail(raw: string): ContactCheck {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "empty" };
  if (!EMAIL_RE.test(value)) return { ok: false, reason: "malformed_email" };
  const [local, domain] = value.toLowerCase().split("@");
  const labels = domain.split(".");
  const tld = labels.at(-1) ?? "";
  if (RESERVED_TLDS.has(tld)) return { ok: false, reason: `reserved_tld:.${tld}` };
  // example.com / example.org / example.net / example.anything
  if (labels.length >= 2 && RESERVED_SLDS.has(labels.at(-2) ?? "")) {
    return { ok: false, reason: "reserved_domain:example" };
  }
  // example-foo.com, foo.example-bar.org, …: obvious placeholders
  if (labels.some((l) => l === "example" || l.startsWith("example-") || l.endsWith("-example"))) {
    return { ok: false, reason: "placeholder_domain" };
  }
  if (labels.includes("localhost")) return { ok: false, reason: "localhost" };
  if (PLACEHOLDER_LOCAL_PARTS.has(local)) {
    return { ok: false, reason: "placeholder_local_part" };
  }
  return { ok: true };
}

export function checkXHandle(raw: string): ContactCheck {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "empty" };
  if (/^@?search:/i.test(value)) return { ok: false, reason: "search_placeholder" };
  if (!X_HANDLE_RE.test(value)) return { ok: false, reason: "malformed_handle" };
  const lower = value.slice(1).toLowerCase();
  if (["example", "test", "placeholder", "handle", "username", "todo"].includes(lower)) {
    return { ok: false, reason: "placeholder_handle" };
  }
  return { ok: true };
}

export function checkContact(channel: "x" | "email", value: string): ContactCheck {
  return channel === "email" ? checkEmail(value) : checkXHandle(value);
}

export function isVerifiedContact(channel: "x" | "email", value: string): boolean {
  return checkContact(channel, value).ok;
}
