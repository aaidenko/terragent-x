import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader({ active }: { active?: "home" | "mission" }) {
  return (
    <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-10">
      <Link
        href="/"
        className="font-heading text-xl font-extrabold tracking-tight text-primary md:text-2xl"
      >
        Terragent
      </Link>
      <nav className="flex items-center gap-2 md:gap-3">
        <Link
          href="/"
          className={`px-3 py-1.5 text-sm ${active === "home" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Company
        </Link>
        <Link
          href="/mission"
          className={cn(
            buttonVariants({
              size: "sm",
              variant: active === "mission" ? "default" : "secondary",
            }),
          )}
        >
          Mission control
        </Link>
      </nav>
    </header>
  );
}
