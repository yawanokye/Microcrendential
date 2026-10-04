import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { createCertificatePdf } from "../src/lib/certificate-pdf";
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

test("downloaded certificates are generated as readable landscape PDFs", async () => {
  const bytes = await createCertificatePdf({
    certificate_code: "UCC-2026-ABCDEF123456",
    learner_name: "Acceptance Test Learner",
    course_code: "UCC-MC-204",
    course_title: "Applied Data Literacy for Evidence-Based Decision-Making",
    credential_type: "microcredential",
    issued_at: "2026-10-04T12:00:00.000Z",
    expires_at: null,
    award_type: "microcredential_achievement",
    issuance_model: "ucc_issued",
    partner_name: null,
    partner_logo_key: null,
    partner_signatory_name: null,
    partner_signatory_title: null,
    partner_signature_key: null,
    cpd_hours: 0,
    cpd_points: 0,
    professional_approval_body: null,
    professional_approval_reference: null,
    show_academic_lead: 0,
    facilitator_name: null,
    facilitator_title: null,
    facilitator_signature_key: null,
    provost_name: "Authorised University Signatory",
    provost_title: "University of Cape Coast",
    provost_signature_key: null,
  }, "https://ucc-microcredential-platform.onrender.com/verify-credential?code=UCC-2026-ABCDEF123456");
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
  const document = await PDFDocument.load(bytes);
  const [page] = document.getPages();
  assert.ok(page.getWidth() > page.getHeight());
  assert.ok(bytes.byteLength > 10_000);
});
