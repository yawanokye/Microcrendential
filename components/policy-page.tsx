import Image from "next/image";
import type { ReactNode } from "react";
import { UccGrowthWordmark } from "@/components/ucc-brand";

export function PolicyPage({ eyebrow, title, summary, children }: { eyebrow: string; title: string; summary: string; children: ReactNode }) {
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  return <main className="policy-shell"><header className="policy-header"><a href="/"><Image unoptimized width={54} height={54} src="/ucc_crest_approved_2026.png" alt="University of Cape Coast crest" /><span><b><UccGrowthWordmark /></b><small>Professional and lifelong learning</small></span></a><nav><a href="/">Home</a><a href="/support">Support</a><a href="/student-signin">Learner sign in</a></nav></header><article className="policy-card"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="policy-summary">{summary}</p><div className="policy-meta"><span>Official pilot edition</span><span>Last reviewed 21 September 2026</span></div><div className="policy-content">{children}</div>{supportEmail && <footer>Questions may be sent to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</footer>}</article><footer className="policy-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/accessibility">Accessibility</a><a href="/refund-policy">Payments and refunds</a><a href="/support">Support</a></footer></main>;
}
