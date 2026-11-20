import { Brand, Panel, Pill, Strip } from "@/components/deck/primitives";

export default function Loading() {
  return (
    <main className="grid min-h-[100svh] md:grid-cols-[minmax(0,0.43fr)_minmax(0,0.57fr)]">
      <Panel tone="ink" className="flex flex-col">
        <Strip left={<Brand />} className="md:grid-cols-[1fr_auto]" />
        <div className="flex flex-1 flex-col justify-between px-5 pt-8 pb-10 md:px-10">
          <h1 className="text-display-l text-paper/30">
            Mission
            <br />
            control
          </h1>
          <div className="relative h-px overflow-hidden bg-hair">
            <span className="absolute inset-y-0 left-0 w-1/4 animate-scan bg-paper/70" />
          </div>
        </div>
      </Panel>
      <Panel tone="dusk" className="hidden md:block">
        <Strip className="md:grid-cols-[1fr_auto]" right={<Pill className="text-faint">Connecting</Pill>} />
      </Panel>
    </main>
  );
}
