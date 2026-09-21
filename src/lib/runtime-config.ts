export const isTrue = (value: string | undefined) => value?.trim().toLowerCase() === "true";

export const paymentsEnabled = () => isTrue(process.env.PAYMENTS_ENABLED);
const secureDefault = (value: string | undefined) => value === undefined ? process.env.NODE_ENV === "production" : value.trim().toLowerCase() !== "false";
export const staffMfaRequired = () => secureDefault(process.env.STAFF_MFA_REQUIRED);
export const emailVerificationRequired = () => secureDefault(process.env.EMAIL_VERIFICATION_REQUIRED);
export const publicRegistrationEnabled = () => process.env.PUBLIC_REGISTRATION_ENABLED?.trim().toLowerCase() !== "false";
export const pilotLearnerLimit = () => {
  const limit = Number(process.env.PILOT_MAX_LEARNERS || 50);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, 10_000) : 50;
};
