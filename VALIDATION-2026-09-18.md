# Validation Notes — Policy-Aligned Governance Update

Date: 18 September 2026

## Checks completed successfully

- TypeScript syntax/transpilation check passed for all changed TypeScript/TSX files.
- Fresh SQLite schema check passed for the new programme approval and certificate pre-authorisation fields.
- Legacy database migration check passed: existing active certificate-enabled programmes are automatically marked certificate-preauthorised so current automatic issuance is not interrupted.
- Course-design governance check passed for programme initiation source, originating unit, programme home and contributing units.
- Static safety checks confirmed:
  - programme source/home metadata is present;
  - activation is based on a recorded committee decision;
  - certificate issuance requires programme-level pre-authorisation, not learner-by-learner approval;
  - automatic certificate issue triggers remain connected to learning progress, assessments, virtual labs, Colab submissions and certificate payment;
  - internal approval records are removed from learner course API responses;
  - published-course amendments record the approving authority/date/reference before application.

## Full build limitation in this environment

`npm ci` could not complete because the container could not resolve/reach the npm registry (`EAI_AGAIN`). An offline retry also failed because `zod-validation-error-4.0.2.tgz` was not present in the local npm cache. Therefore `npm test`, `npm run lint`, and the full dependency-backed `npm run build` could not be executed here. Run the normal repository CI/build after upload to an environment with npm registry access.
