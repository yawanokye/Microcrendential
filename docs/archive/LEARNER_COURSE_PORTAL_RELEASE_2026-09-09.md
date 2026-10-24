# Learner Course Portal release — 9 September 2026

## What changed

- Every enrolled-course card and dashboard course row is now clickable by mouse and keyboard.
- The course catalogue opens full course details before enrolment.
- An enrolled learner enters a dedicated full-screen course portal.
- The portal separates Course home, Learning content, Activities, Assessment, and Progress & award.
- PDF, Word-to-readable-HTML, video, transcript, embed and downloadable learning materials remain available through the content viewer.
- Colab and virtual-practical activities retain their existing submission workflows.
- Assessment remains connected to recorded scores, completion gates and QR certificate issuance.
- Unenrolled learners cannot open the learner experience from the interface; they see the course details and enrolment action first.
- Responsive navigation is included for desktop, tablet and mobile use.

## Included build correction

The manual-course importer now supplies `certificateFeeGhs: 0` and keeps imported courses open and free by default. The obsolete fee and restricted-enrolment inference variables were removed.

## Verification

- Next.js 16.2.6 production build passed.
- TypeScript passed.
- All 48 routes were generated.
- ESLint completed with zero errors; the 12 existing non-blocking warnings remain.

Upload the extracted project contents to the GitHub repository root. Do not upload `node_modules`, `.next`, `ucc_repair`, SQLite data files, or the ZIP itself.
