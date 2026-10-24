"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ModeResponse = { mode?: "demonstration" | "official_pilot"; fullFunctionalityEnabled?: boolean };

export function PlatformModeBanner() {
  const [status, setStatus] = useState<ModeResponse>();
  useEffect(() => {
    fetch("/api/platform-mode", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: ModeResponse) => setStatus(result))
      .catch(() => setStatus({ mode: "demonstration", fullFunctionalityEnabled: false }));
  }, []);
  if (status?.mode !== "demonstration") return null;
  return <div className="platform-mode-banner" role="status"><AlertTriangle /><strong>Acceptance environment</strong><span>{status.fullFunctionalityEnabled ? "Full functionality is active on this Render deployment, including Google OAuth email codes and approved credential issuance." : "Emergency restricted operation is active. Authentication codes and new credential issuance are temporarily unavailable."}</span></div>;
}
