"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ModeResponse = { mode?: "demonstration" | "official_pilot"; fullFunctionalityEnabled?: boolean;officialCredentialsEnabled?:boolean;checkoutAllowed?:boolean };

export function PlatformModeBanner() {
  const [status, setStatus] = useState<ModeResponse>();
  useEffect(() => {
    fetch("/api/platform-mode", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: ModeResponse) => setStatus(result))
      .catch(() => setStatus({ mode: "demonstration", fullFunctionalityEnabled: false }));
  }, []);
  if (status?.mode !== "demonstration") return null;
  return <div className="platform-mode-banner" role="status"><AlertTriangle /><strong>Acceptance environment</strong><span>{status.fullFunctionalityEnabled ? `Learning and sign-in are available. ${status.officialCredentialsEnabled ? "Official certificate issuance is explicitly enabled for acceptance." : "New official certificates are paused until authorised."} ${status.checkoutAllowed ? "Checkout is explicitly enabled for acceptance." : "New online payments are paused."}` : "Emergency restricted operation is active. Authentication codes and new credential issuance are temporarily unavailable."}</span></div>;
}
