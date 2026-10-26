# Full certificate and degree programmes, v13.5.0

The platform can now deliver a complete credit-bearing qualification across semesters or terms. A programme has an approved curriculum, admission records, course registration, semester results, an academic transcript and a programme-level certificate. Certificate, advanced certificate, diploma, postgraduate diploma, bachelor's, master's and doctoral levels are available. The institution supplies the exact qualification title and its approved requirements.

Programme tools are optional. Existing courses, microcredentials, fees, certificates, working Python labs, H5P/LTI activities and the practical skip choices remain available. Existing offerings retain their access settings through the established course snapshots. No existing course is converted into a degree course automatically.

## Develop the qualification

1. Open **Programme studio** in the facilitator portal, or visit `/programmes` while signed in. Choose **Create programme**.
2. Enter the programme code, title, exact qualification title, level, responsible academic unit, description, admission requirements, approved duration and delivery mode.
3. Add the semesters or terms in their intended order. Build and approve the individual courses through Course Studio, then select them for the curriculum. Set credits, core or elective status, semester placement, prerequisites and pass requirements.
4. Add projects, practicums and theses as assessed courses. Their learning materials, laboratory tasks, submissions, marking and feedback use the existing course delivery tools. Select them as core when they must be passed.
5. Set the total credit requirement. For elective groups, define the minimum credits and the available choices. A course cannot be counted twice. Missing courses, impossible credit totals, circular prerequisites and incomplete elective groups block submission.
6. Enable any additional policies needed for this programme. Save a draft, complete its requirements and submit it for academic approval.

The following policies begin disabled and are selected independently:

- Registry release before registration in a later term.
- Counting earlier passes from the same platform course.
- Credit recognition, with an explicit maximum credit limit.
- GPA calculation, using the programme's approved grade bands and minimum GPA.
- Creating a programme-level certificate.
- Including the programme lead's registered signature.

An administrator records the academic authority, reference and valid approval date before opening the programme. If certificate creation is selected, the administrator must explicitly confirm that the recorded decision authorises issuance. The Provost signature must be registered. The programme lead's signature must also be registered when selected.

## Semester delivery and admission

Learners open **My programmes**, inspect the curriculum and admission requirements, and submit an application. An application does not admit the learner or enrol them in every course.

The registry admits the learner with an admission reference, student number and cohort. It records whether existing course fees remain payable or whether an identified programme tuition clearance covers course access. A clearance reference is mandatory when programme tuition coverage is selected. Clearance can be updated later with an audit reason. The platform does not invent a payment or add it to payment reports.

Admitted learners register for courses from their pinned curriculum. Registration honours prerequisites, selected term-release controls, course availability, intake capacity and applicable fees. It creates or reuses the course enrolment atomically and retains the actual course snapshot. Concurrent or repeated registration does not create duplicate records.

For a programme-only module, select **Offering purpose → Course within a full certificate or degree programme**, then **Programme course access → Registration through an admitted programme only** in Course Studio. This is an explicit choice. Direct self-enrolment cannot bypass it. New registration and protected assessment submissions are blocked when a programme-only enrolment is deferred or withdrawn. Earlier course results and programme records remain retained.

The registry can defer, resume or withdraw a programme enrolment, and release the next term with a recorded reason. When term-release enforcement is enabled, earlier core and elective-credit requirements must be satisfied before release.

## Detailed results and transcripts

The programme record displays each semester separately. Registered or recognised courses appear on the transcript with their course code, title, credit value, released percentage mark, grade, grade points, quality points, earned credits and result status. Unselected electives do not appear as failed or missing transcript courses.

Semester GPA and cumulative GPA use the approved grading bands when GPA calculation is enabled:

`GPA = sum(course credits × grade points) / sum(graded course credits)`

The calculation uses the latest released attempt for each programme course, includes released failed marks and excludes recognised credits. Pending results do not become zero marks. GPA is compared against the configured threshold before display rounding. Programme-course aggregates follow this latest-released-attempt rule. Existing standalone microcredentials retain their established best-pass aggregate rule.

Recognised credit is labelled **CR** and requires a registry decision, approval reference and evidence reason. A mark may be recorded when supplied, but recognised credits do not enter GPA. The approved cap is enforced. Credit recognition cannot overwrite a registered platform course's assessment workflow.

Learners and authorised programme staff can download the academic transcript as PDF, CSV or JSON. The transcript is provisional during study. It becomes final after the approved award release. A changed final result or revoked award places the record under academic review. Private transcripts and student numbers are not exposed by public verification.

## Certificate creation after completion

In the programme editor, enable **Create a certificate for the full programme** and select a release policy:

| Release policy | Certificate creation |
| --- | --- |
| Automatically after all approved requirements are complete | The platform creates the programme certificate once all required courses, elective credit requirements, total credits, configured GPA, course completion evidence and verified learner identity pass. Academic activation must have preauthorised issuance. |
| After all requirements and a final registry release | The same requirements must pass. The registry then records the approved award reference, award date and decision note. The programme certificate is created from that release. |

The automatic policy does not require another facilitator action after the last eligible result is released. Synchronisation also runs when a programme record is opened and through the existing background maintenance worker, covering a verification requirement completed later. The platform's existing official-credential availability control still applies.

Certificate creation is idempotent. One programme enrolment receives one certificate code. The downloadable PDF contains the learner name, exact qualification title, earned credits, curriculum version, award date, registered signatures, UCC crest and a live verification QR code. Degree awards use the degree certificate title and the approved qualification name rather than a microcredential label.

Learners find **Download programme certificate** in their programme record. The QR opens `/verify-programme` and checks the current award status. It reveals the award details needed for verification, while keeping marks, transcripts, student numbers, email addresses and identity evidence private.

A later released-result correction flags the final award, certificate and transcript for review, including a changed mark that still passes. Invalid certificates cannot be downloaded as active credentials. An administrator must review and reconfirm eligibility to restore them. Revocation and restoration require recorded reasons. An existing certificate is not silently replaced with a new identity.

## Curriculum revisions

An approved curriculum is immutable. **Create revised curriculum** makes a separate draft. Once approved, the new version accepts new admissions. Existing learners retain their admitted programme version, its credit requirements and their registered course snapshots. A learner cannot accidentally reapply to a later curriculum to reset their earlier record.

Individual course delivery versions are pinned when the course is registered, using the existing course snapshot mechanism. A previously existing course enrolment retains its earlier snapshot. Earlier passed results require the programme's explicit reuse policy or an authorised credit-recognition decision.

## Deployment and modified files

Upload the complete extracted v13.5.0 source to the existing repository root. Keep the canonical `src/` tree, the complete `public/` folder and the new programme routes. The release retains the earlier repair for misplaced corporate component imports. Keep the existing Render persistent disk and environment settings.

The database change is additive and runs automatically through `src/db/raw.ts`. It adds programme curricula, admissions, registrations, credit decisions, awards and certificates without dropping existing learning records. Take the usual backup before updating an existing deployment.

Principal changes:

| Area | Files |
| --- | --- |
| Programme curriculum rules | `src/lib/programme-policy.ts`, `programme-results.ts`, `programme-transcript.ts` |
| Academic workflow and storage | `src/lib/programmes.ts`, `programme-http.ts`, `src/db/programme-schema.ts`, `src/db/raw.ts` |
| Certificates, transcripts and verification | `src/lib/programme-credentials.ts`, `programme-documents.ts`, `programme-record.ts`, `programme-verification.ts`, `src/app/verify-programme/page.tsx` |
| Protected APIs | `src/app/api/programmes/` with curriculum, enrolment, registration, record, transcript, certificate and public verification routes |
| Learner and facilitator interface | `src/components/programme-workspace.tsx`, `platform-home.tsx`, `src/app/programmes/page.tsx`, `programmes.css`, `layout.tsx` |
| Course integration | `src/lib/course-design.ts`, `course-access.ts`, `course-completion.ts`, `grading-workflow.ts`, `delivery-maintenance.ts` |
| Build and checks | `next.config.mjs`, `package.json`, `package-lock.json`, `scripts/seed-programme-test.ts`, `test-programmes.mjs`, `tests/programme-policy.test.ts`, `tests/commercial-delivery.test.ts` |

Use Node 22.23.4. Run `npm ci --include=dev`, `npm run check:source` and `npm run pilot:check` before starting the production service. `npm run test:programmes` additionally requires Playwright and Chromium and exercises the programme journey with synthetic academic records. The existing Python runtime assets, including `public/vendor/pyodide/python_stdlib.zip`, remain required.

This package implements delivery and the configured academic record workflow. The institution must enter its actual approved curriculum, grading scheme, qualification title and award authorisation. No external admissions system, tuition ledger, regulator database or production deployment is configured by this source update. See `VALIDATION-v13.5.0.md` for the completed checks.
