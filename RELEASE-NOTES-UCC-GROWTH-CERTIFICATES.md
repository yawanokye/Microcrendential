# UCC Growth+ certificate and public experience release

This release is based on `Microcrendential-master (9).zip`, the last archive confirmed to deploy successfully. Its Render, Docker, Next.js, storage and database approach has been retained.

## Certificate issuance

- Facilitators select one of five award types: microcredential achievement, CPD achievement, CPD participation, attendance, or approved professional certification.
- Facilitators select one of five issuance relationships: UCC issued, UCC issued in partnership, jointly issued, partner issued through UCC Growth+, or UCC issued with a sponsor.
- Partner identity, logo, authorised signatory and signature are captured when the selected relationship requires them.
- CPD hours, formally approved CPD points, approving body and approval reference are validated before publication.
- The selected configuration is snapshotted into every issued certificate, including broader stackable credentials, so later course edits cannot silently change an existing award.

## Certificate face and verification

- Certificate output is A4 landscape and prints only the certificate selected by the learner.
- The print document title is the sanitised course code, giving Save as PDF a default filename such as `UCC-CPD-204.pdf`.
- Logos, QR codes and signatures are fetched and converted to embedded data images before printing to prevent them disappearing from saved PDFs.
- The face carries only the award, learner, course, issuer relationship, issue date, CPD value where relevant, signatories, credential ID and QR.
- Course code, credits, learning mode, requirements, current status, partner details and professional approval evidence remain in the live verification portal.
- Printing is disabled for revoked credentials.

## Public UCC Growth+ experience

- New marketplace-style landing page influenced by the supplied edX and FutureLearn references: strong hero, immediate search, trust signals, subject discovery, visual course cards and pathway call-to-action.
- Public messaging makes clear that learning is open to everyone and does not require existing UCC student status.
- The UCC Growth+ wordmark uses a large, bold superscript plus beside `Growth`.
- Learner, educator and administrator entry points remain role-bound.

## Compatibility and deployment

- Existing course designs without certificate configuration are normalised to the safe default: UCC-issued microcredential achievement.
- Existing certificate rows receive database defaults automatically through the established startup `ensureColumn` mechanism.
- Partner certificate assets use the existing durable upload storage abstraction and become publicly readable only after being referenced by an active credential.

## Verification completed

- ESLint: no errors.
- Automated tests: 27 passed.
- Production build: successful, including TypeScript and all 62 routes.
- Database smoke tests: standard CPD issuance and broader stackable issuance both created the expected certificate snapshots.
