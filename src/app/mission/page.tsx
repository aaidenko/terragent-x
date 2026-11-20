import type { Metadata } from "next";
import { landDotsPath } from "@/components/map/land-dots";
import { MissionConsole } from "@/components/mission/mission-console";

export const metadata: Metadata = {
  title: "Mission control",
  description: "Run a live TerragentX pass: public Earth data in, verified briefs and approved outreach out.",
};

export default function MissionPage() {
  return (
    <main className="relative">
      <MissionConsole dots={landDotsPath(9)} />
    </main>
  );
}
