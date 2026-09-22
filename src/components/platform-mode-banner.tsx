"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ModeResponse = { mode?: "demonstration" | "official_pilot" };

export function PlatformModeBanner() {
  const [mode, setMode] = useState<ModeResponse["mode"]>();
  useEffect(() => {
    fetch("/api/platform-mode", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: ModeResponse) => setMode(result.mode))
      .catch(() => setMode("demonstration"));
  }, []);
  if (mode !== "demonstration") return null;
  return <div className="platform-mode-banner" role="status"><AlertTriangle /><strong>Demonstration mode</strong><span>Use test records only. Email codes and official certificate issuance are disabled.</span></div>;
}
