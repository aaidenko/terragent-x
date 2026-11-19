import { SiteHeader } from "@/components/site-header";
import { MissionConsole } from "@/components/mission-console";

export default function MissionPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader active="mission" />
      <main className="flex-1 pt-4">
        <MissionConsole />
      </main>
    </div>
  );
}
