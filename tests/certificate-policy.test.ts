import assert from "node:assert/strict";
import test from "node:test";
import {
  certificateConfigurationFromSnapshot,
  certificatePartnershipStatement,
  certificateTitle,
  defaultCertificateConfiguration,
  safeCertificateFilename,
  validateCertificateConfiguration,
} from "../src/lib/certificate-policy";

test("course code becomes a safe PDF filename", () => {
  assert.equal(safeCertificateFilename("UCC CPD/204"), "UCC-CPD-204.pdf");
  assert.equal(safeCertificateFilename("  "), "UCC-Certificate.pdf");
});

test("joint issuance requires partner identity, logo and authorised signatory", () => {
  const configuration = { ...defaultCertificateConfiguration(), issuanceModel: "jointly_issued" as const, partnerName: "Professional Institute" };
  const result = validateCertificateConfiguration(configuration);
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /partner logo/i);
  assert.match(result.issues.join(" "), /signatory/i);
});

test("CPD points require traceable approval", () => {
  const configuration = { ...defaultCertificateConfiguration(), awardType: "cpd_achievement" as const, cpdHours: 12, cpdPoints: 3 };
  assert.equal(validateCertificateConfiguration(configuration).valid, false);
  const approved = { ...configuration, approvalBody: "Ghana CPD Council", approvalReference: "CPD-2026-104" };
  assert.equal(validateCertificateConfiguration(approved).valid, true);
  assert.equal(certificateTitle(approved.awardType), "Certificate of CPD Achievement");
});

test("issued certificate snapshots reconstruct partnership wording", () => {
  const configuration = certificateConfigurationFromSnapshot({ award_type: "cpd_participation", issuance_model: "partner_issued", partner_name: "Professional Institute", cpd_hours: 8 });
  assert.equal(configuration.partnerName, "Professional Institute");
  assert.equal(certificatePartnershipStatement(configuration), "Issued by Professional Institute and delivered through UCC Growth+");
});
