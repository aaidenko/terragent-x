import type { MarketId } from "./playbooks";

export type SignalEvent = {
  id: string;
  market: MarketId;
  title: string;
  summary: string;
  lat: number;
  lon: number;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  sourceUrl?: string;
  observedAt: string;
  metrics?: Record<string, string | number>;
  xHints?: string[];
};

export type AnalysisBrief = {
  id: string;
  eventId: string;
  market: MarketId;
  headline: string;
  finding: string;
  confidence: number;
  method: string[];
  metrics: Record<string, string | number>;
  limitations: string[];
  createdAt: string;
  mapHint: { lat: number; lon: number; label: string };
};

export type Prospect = {
  id: string;
  eventId: string;
  name: string;
  kind: string;
  why: string;
  channel: "x" | "email";
  handleOrEmail: string;
  fitScore: number;
};

export type OutreachDraft = {
  id: string;
  prospectId: string;
  eventId: string;
  channel: "x" | "email";
  to: string;
  subject?: string;
  body: string;
  status: "draft" | "approved" | "sent" | "failed";
  createdAt: string;
  sentAt?: string;
};

export type LoopRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "awaiting_approval" | "complete" | "error";
  steps: { name: string; detail: string; at: string }[];
  eventIds: string[];
  briefIds: string[];
  prospectIds: string[];
  outreachIds: string[];
  error?: string;
};
