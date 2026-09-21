export type CertificateAwardType =
  | "microcredential_achievement"
  | "cpd_achievement"
  | "cpd_participation"
  | "attendance"
  | "professional_certification";

export type CertificateIssuanceModel =
  | "ucc_issued"
  | "ucc_partnered"
  | "jointly_issued"
  | "partner_issued"
  | "ucc_sponsored";

export type CertificateConfiguration = {
  awardType: CertificateAwardType;
  issuanceModel: CertificateIssuanceModel;
  partnerName: string;
  partnerLogoKey: string;
  partnerSignatoryName: string;
  partnerSignatoryTitle: string;
  partnerSignatureKey: string;
  showAcademicLead: boolean;
  cpdHours: number;
  cpdPoints: number;
  approvalBody: string;
  approvalReference: string;
};

export const certificateAwardOptions: { value: CertificateAwardType; label: string; description: string }[] = [
  { value: "microcredential_achievement", label: "Microcredential achievement", description: "Assessed learning leading to a University microcredential." },
  { value: "cpd_achievement", label: "CPD achievement", description: "Assessed continuing professional development with recorded learning hours." },
  { value: "cpd_participation", label: "CPD participation", description: "Completion of a CPD learning activity where participation is the award basis." },
  { value: "attendance", label: "Attendance", description: "Attendance evidence only. It does not claim assessed competence." },
  { value: "professional_certification", label: "Professional certification", description: "Use only with documented authority from the named professional or regulatory body." },
];

export const certificateIssuanceOptions: { value: CertificateIssuanceModel; label: string; description: string }[] = [
  { value: "ucc_issued", label: "UCC issued", description: "UCC owns and awards the course." },
  { value: "ucc_partnered", label: "UCC issued in partnership", description: "UCC issues the credential and recognises a delivery or development partner." },
  { value: "jointly_issued", label: "Jointly issued", description: "UCC and the partner jointly approve and award the credential." },
  { value: "partner_issued", label: "Partner issued", description: "The partner awards the credential and UCC Growth+ provides the delivery platform." },
  { value: "ucc_sponsored", label: "UCC issued with sponsor", description: "UCC awards the course and identifies an external sponsor or supporter." },
];

export const defaultCertificateConfiguration = (): CertificateConfiguration => ({
  awardType: "microcredential_achievement",
  issuanceModel: "ucc_issued",
  partnerName: "",
  partnerLogoKey: "",
  partnerSignatoryName: "",
  partnerSignatoryTitle: "",
  partnerSignatureKey: "",
  showAcademicLead: false,
  cpdHours: 0,
  cpdPoints: 0,
  approvalBody: "",
  approvalReference: "",
});

const assetKey = (value: unknown) => {
  const key = String(value ?? "").trim();
  return /^certificate-branding\/[a-zA-Z0-9/_\-.]+$/.test(key) ? key : "";
};

export function normalizeCertificateConfiguration(value: unknown): CertificateConfiguration {
  const fallback = defaultCertificateConfiguration();
  const input = value && typeof value === "object" ? value as Partial<CertificateConfiguration> : {};
  const awardTypes = new Set<CertificateAwardType>(certificateAwardOptions.map((item) => item.value));
  const issuanceModels = new Set<CertificateIssuanceModel>(certificateIssuanceOptions.map((item) => item.value));
  return {
    awardType: awardTypes.has(input.awardType as CertificateAwardType) ? input.awardType as CertificateAwardType : fallback.awardType,
    issuanceModel: issuanceModels.has(input.issuanceModel as CertificateIssuanceModel) ? input.issuanceModel as CertificateIssuanceModel : fallback.issuanceModel,
    partnerName: String(input.partnerName ?? "").trim().slice(0, 240),
    partnerLogoKey: assetKey(input.partnerLogoKey),
    partnerSignatoryName: String(input.partnerSignatoryName ?? "").trim().slice(0, 160),
    partnerSignatoryTitle: String(input.partnerSignatoryTitle ?? "").trim().slice(0, 160),
    partnerSignatureKey: assetKey(input.partnerSignatureKey),
    showAcademicLead: Boolean(input.showAcademicLead),
    cpdHours: Math.min(2_000, Math.max(0, Number(input.cpdHours) || 0)),
    cpdPoints: Math.min(2_000, Math.max(0, Number(input.cpdPoints) || 0)),
    approvalBody: String(input.approvalBody ?? "").trim().slice(0, 240),
    approvalReference: String(input.approvalReference ?? "").trim().slice(0, 240),
  };
}

export function certificateConfigurationFromSnapshot(value: {
  award_type?: unknown; issuance_model?: unknown; partner_name?: unknown; partner_logo_key?: unknown;
  partner_signatory_name?: unknown; partner_signatory_title?: unknown; partner_signature_key?: unknown;
  show_academic_lead?: unknown; cpd_hours?: unknown; cpd_points?: unknown;
  professional_approval_body?: unknown; professional_approval_reference?: unknown;
}): CertificateConfiguration {
  return normalizeCertificateConfiguration({
    awardType: value.award_type,
    issuanceModel: value.issuance_model,
    partnerName: value.partner_name,
    partnerLogoKey: value.partner_logo_key,
    partnerSignatoryName: value.partner_signatory_name,
    partnerSignatoryTitle: value.partner_signatory_title,
    partnerSignatureKey: value.partner_signature_key,
    showAcademicLead: Boolean(value.show_academic_lead),
    cpdHours: value.cpd_hours,
    cpdPoints: value.cpd_points,
    approvalBody: value.professional_approval_body,
    approvalReference: value.professional_approval_reference,
  });
}

export const isCpdAward = (awardType: CertificateAwardType) => awardType === "cpd_achievement" || awardType === "cpd_participation";
export const requiresPartner = (model: CertificateIssuanceModel) => model !== "ucc_issued";
export const requiresPartnerSignatory = (model: CertificateIssuanceModel) => model === "jointly_issued" || model === "partner_issued";
export const requiresUccSignatory = (model: CertificateIssuanceModel) => model !== "partner_issued";

export function validateCertificateConfiguration(configuration: CertificateConfiguration) {
  const issues: string[] = [];
  if (requiresPartner(configuration.issuanceModel) && configuration.partnerName.length < 2) issues.push("Enter the partner or sponsor institution.");
  if (requiresPartnerSignatory(configuration.issuanceModel)) {
    if (!configuration.partnerLogoKey) issues.push("Upload the issuing partner logo.");
    if (!configuration.partnerSignatoryName) issues.push("Enter the authorised partner signatory.");
    if (!configuration.partnerSignatoryTitle) issues.push("Enter the partner signatory title.");
    if (!configuration.partnerSignatureKey) issues.push("Upload the authorised partner signature.");
  }
  if (isCpdAward(configuration.awardType) && configuration.cpdHours <= 0) issues.push("Record the CPD learning hours.");
  if (configuration.awardType === "professional_certification") {
    if (!configuration.approvalBody) issues.push("Name the professional or regulatory body authorising certification.");
    if (!configuration.approvalReference) issues.push("Record the professional approval reference.");
  }
  if (configuration.cpdPoints > 0 && (!configuration.approvalBody || !configuration.approvalReference)) issues.push("CPD points require an approving body and approval reference.");
  return { valid: issues.length === 0, issues };
}

export function certificateTitle(awardType: CertificateAwardType) {
  if (awardType === "cpd_achievement") return "Certificate of CPD Achievement";
  if (awardType === "cpd_participation") return "Certificate of CPD Participation";
  if (awardType === "attendance") return "Certificate of Attendance";
  if (awardType === "professional_certification") return "Professional Certification";
  return "Certificate of Achievement";
}

export function certificateEyebrow(awardType: CertificateAwardType, stacked = false) {
  if (stacked) return "UCC STACKABLE CREDENTIAL";
  if (awardType === "cpd_achievement" || awardType === "cpd_participation") return "CONTINUING PROFESSIONAL DEVELOPMENT";
  if (awardType === "attendance") return "VERIFIED COURSE ATTENDANCE";
  if (awardType === "professional_certification") return "PROFESSIONAL CREDENTIAL";
  return "UCC MICRO-CREDENTIAL";
}

export function certificateAchievementStatement(awardType: CertificateAwardType) {
  if (awardType === "cpd_participation") return "has completed the continuing professional development programme";
  if (awardType === "attendance") return "has attended and completed";
  if (awardType === "professional_certification") return "has satisfied the approved professional certification requirements for";
  return "has successfully completed and satisfied the assessed requirements for";
}

export function certificateIssuerName(configuration: CertificateConfiguration) {
  if (configuration.issuanceModel === "partner_issued") return configuration.partnerName || "Partner Institution";
  if (configuration.issuanceModel === "jointly_issued") return `University of Cape Coast and ${configuration.partnerName || "Partner Institution"}`;
  return "University of Cape Coast";
}

export function certificatePartnershipStatement(configuration: CertificateConfiguration) {
  if (configuration.issuanceModel === "ucc_partnered") return `Issued by the University of Cape Coast in partnership with ${configuration.partnerName}`;
  if (configuration.issuanceModel === "jointly_issued") return `Jointly issued by the University of Cape Coast and ${configuration.partnerName}`;
  if (configuration.issuanceModel === "partner_issued") return `Issued by ${configuration.partnerName} and delivered through UCC Growth+`;
  if (configuration.issuanceModel === "ucc_sponsored") return `Issued by the University of Cape Coast with support from ${configuration.partnerName}`;
  return "Issued by the University of Cape Coast through UCC Growth+";
}

export function safeCertificateFilename(courseCode: string) {
  const normalized = courseCode.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${normalized || "UCC-Certificate"}.pdf`;
}
