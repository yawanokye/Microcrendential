import type { Metadata } from "next";
import "./globals.css";
import "./programme-activities.css";
import "./lab-visuals.css";

export const metadata: Metadata = {
  title: "UCC Microcredential Learning Platform",
  description: "Flexible, assessed and quality-assured learning from the University of Cape Coast.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
