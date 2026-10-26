import { Suspense } from "react";
import { PublicOfferingCatalogue } from "@/components/learning-discovery";
export const metadata = { title: "Explore courses and programmes · UCC Growth+", description: "Browse University of Cape Coast microcredentials, CPD, full certificates, diplomas and degree programmes." };
export default function ExplorePage() { return <Suspense fallback={<main className="learning-catalogue-empty">Loading the learning catalogue…</main>}><PublicOfferingCatalogue /></Suspense>; }
