import { ImageResponse } from "next/og";

export const alt = "TerragentX — Ask about any place on Earth, or we'll come to you with the answer.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The deck's title slide, as a social card. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "44px 56px 52px",
          color: "#f4f5f6",
          background: "linear-gradient(160deg, #6b7581 0%, #465062 42%, #262d3c 78%, #1c1e24 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20 }}>
          <span>TerragentX</span>
          <span style={{ opacity: 0.7 }}>Earth intelligence, agent-run</span>
          <span
            style={{
              padding: "6px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.12)",
            }}
          >
            Live public data
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 210, lineHeight: 0.84, letterSpacing: "-0.06em", display: "flex" }}>Terragent</div>
          <div style={{ fontSize: 210, lineHeight: 0.84, letterSpacing: "-0.06em", display: "flex" }}>X</div>
          <div style={{ marginTop: 34, fontSize: 26, opacity: 0.75, display: "flex" }}>
            Ask about any place on Earth, or we&apos;ll come to you with the answer.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
