import type { Metadata } from "next";
import "./globals.css";
import "./programme-activities.css";
import "./lab-visuals.css";
import "./modern-platform.css";
import "./commercial-course-studio.css";
import "./professional-public-landing.css";
import "./certificate-template-platform.css";
import "./ucc-brand.css";

export const metadata: Metadata = {
  title: "UCC Growth+ Learning Platform",
  description: "Flexible, assessed and quality-assured learning from the University of Cape Coast.",
  icons: { icon: "/ucc_crest_approved_2026.png", shortcut: "/ucc_crest_approved_2026.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
