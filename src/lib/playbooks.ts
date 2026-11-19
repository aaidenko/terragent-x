export type MarketId =
  | "disasters"
  | "wildfire"
  | "deforestation"
  | "mining"
  | "private_brokerage";

export type Playbook = {
  id: MarketId;
  name: string;
  status: "live" | "ready" | "roadmap";
  pitch: string;
  signals: string[];
  buyers: string[];
  analysis: string;
  dataSources: string[];
  priceHint: string;
};

export const PLAYBOOKS: Playbook[] = [
  {
    id: "disasters",
    name: "Disasters & property",
    status: "live",
    pitch:
      "When rivers crest or storms hit, send property managers a verified flood/impact brief before adjusters arrive.",
    signals: ["NWS flood warnings", "NOAA river gauges", "OpenFEMA", "X local ground truth"],
    buyers: ["Property managers", "HOAs", "Lenders", "Small insurers", "Marinas"],
    analysis: "Gauge stage vs flood thresholds + water-extent heuristics on the AOI",
    dataSources: ["api.weather.gov", "water.weather.gov / USGS NWIS", "NASA EONET"],
    priceHint: "$29–$99 per asset brief",
  },
  {
    id: "wildfire",
    name: "Wildfire & burn scar",
    status: "live",
    pitch:
      "Hotspots from FIRMS become burn-risk and asset-exposure briefs for landowners and timber buyers.",
    signals: ["NASA FIRMS VIIRS/MODIS", "EONET wildfires", "NIFC", "X evacuations"],
    buyers: ["Timber operators", "Ranchers", "Utilities", "County EM", "Insurers"],
    analysis: "Cluster hotspots, estimate acres, score assets inside a buffer",
    dataSources: ["FIRMS", "EONET", "IRWIN"],
    priceHint: "$39–$149 per site",
  },
  {
    id: "deforestation",
    name: "Deforestation compliance",
    status: "ready",
    pitch:
      "Forest-loss alerts mapped to commodity suppliers for EUDR-style due diligence.",
    signals: ["Global Forest Watch", "NASA FIRMS", "Trade/news via X + web"],
    buyers: ["Coffee/cocoa/palm importers", "ESG teams", "Auditors"],
    analysis: "Tree-cover loss near supplier parcels over a window",
    dataSources: ["GFW", "Sentinel-2 / Planetary Computer"],
    priceHint: "$99–$499 compliance pack",
  },
  {
    id: "mining",
    name: "Mine expansion",
    status: "ready",
    pitch:
      "Detect pit growth and spoil piles for landowners, juniors, and local governments.",
    signals: ["BLM claims", "USGS minerals", "Company news on X", "EONET"],
    buyers: ["Junior miners", "Landowners", "Regulators"],
    analysis: "Change detection on open-pit footprints",
    dataSources: ["Sentinel-2", "BLM", "USGS"],
    priceHint: "$149–$799 monitoring",
  },
  {
    id: "private_brokerage",
    name: "Private data brokerage",
    status: "roadmap",
    pitch:
      "When free public EO is not enough, agents compare paid imagery providers, quote uplift, and broker the pixels — selling the answer, not the raw scene.",
    signals: ["Customer request", "Cloud cover failure on free stack"],
    buyers: ["Same markets, higher willingness to pay"],
    analysis: "Provider registry + price compare + license fit",
    dataSources: ["SkyWatch / UP42 / Arlula (future)", "Commercial tasking"],
    priceHint: "Pass-through + margin on paid scenes",
  },
];

export function playbookById(id: MarketId) {
  return PLAYBOOKS.find((p) => p.id === id);
}
