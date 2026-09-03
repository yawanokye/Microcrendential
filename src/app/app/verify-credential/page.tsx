import CredentialVerifier from "./verifier";

export const metadata = {
  title: "Verify a credential · UCC Microcredentials",
  description: "Publicly verify a UCC digital microcredential.",
};

export default async function VerifyCredentialPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const parameters = await searchParams;
  return <CredentialVerifier initialCode={parameters.code ?? ""} />;
}
