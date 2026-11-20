import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/*
 * One typeface family for everything. Inter's optical-size axis gives the
 * "Display" cut automatically at large sizes. Swap here for a licensed
 * neo-grotesk later — every style reads --font-inter.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://terragentx.apps.grok.bot"),
  title: {
    default: "TerragentX · Earth intelligence, agent-run",
    template: "%s · TerragentX",
  },
  description:
    "TerragentX reads live public Earth data — river gauges, flood alerts, wildfires — and turns it into verified briefs for the people on the ground.",
  applicationName: "TerragentX",
  openGraph: {
    title: "TerragentX",
    description: "Ask about any place on Earth, or we'll come to you with the answer.",
    siteName: "TerragentX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TerragentX",
    description: "Ask about any place on Earth, or we'll come to you with the answer.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1e24",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full`}>
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
