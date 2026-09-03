# UCC Microcredential Learning Platform — GitHub/Render Edition

This package contains dedicated student, facilitator and system-administration portals; a separate student registration journey; a commercial outcome-led Course Studio; structured syllabi; versioned drafts and academic release; protected PDF/Word/media content; readable-HTML conversion; identity verification; stackable learning pathways; a lifelong skills passport; assessments; mathematical whiteboard; YouTube transcript review; free Google Colab coding assignments; realistic interactive virtual laboratories; governed UCC digital certificates with scannable verification QR codes; public credential verification; and institution-level learning analytics.

Each role has a separate operational experience:

- **Students** register through `/student-registration` and see only their learning journey, approved course catalogue, assessment activities, live sessions, community, practicals, private skills passport and credential wallet.
- **Facilitators** see course design, teaching, marking, cohort intelligence, assigned identity reviews and quality-testing tools; student registration and private credential-wallet screens are excluded.
- **System administrators** see access governance, academic approvals, identity governance, the institution-wide credential registry, credential revocation/restoration and platform analytics; student delivery screens are excluded.

Role separation is enforced by both the interface and the API. Hiding a navigation item is never treated as authorisation.

The public selector now sends each role through a dedicated gateway:

- Student sign-in: `/student-signin`
- Facilitator sign-in and invitation activation: `/facilitator-signin`
- System-administrator sign-in and first-admin setup: `/admin-signin`

The requested portal role is validated before a session is issued. A learner credential submitted to the facilitator or administration gateway—and the equivalent cross-role attempts for staff—is rejected with a role-bound access error.

## Contemporary microcredential capabilities

- A six-stage **Commercial Course Studio** covers product blueprint, course objectives, measurable outcomes, skills, syllabus sections, content, authentic activities, assessment and quality review. Draft saves use optimistic version checks and only a 100% publish-ready submission can enter academic activation.
- Facilitators can author text or sanitised HTML, upload protected files, or import a public link. `.PDF`, `.DOCX`, `.TXT`, `.MD`, `.HTML` and `.RTF` sources are converted to readable HTML where possible; the protected original remains available to authorised learners. Other Word, PowerPoint, image, audio and video files remain protected course attachments.
- Every learning block records its section, unit, estimated time, source/licence, accessibility review and mapped learning outcomes. The learner course view presents the same structured syllabus, objectives, outcomes and authentic evidence requirements.
- A dedicated four-step **Student Registration Portal** creates a secure account, captures learner and accessibility preferences, protects identity evidence, and assigns a unique student number.
- The identity-document control supports device selection and drag-and-drop, validates the actual JPG/PNG/PDF file signature even when a scanner supplies a generic MIME type, and shows the attached filename, size and secured status. Learners can replace or remove the scan before submission.
- A private **Skills Passport** combines earned credentials, assessed practical competencies and progress towards stackable discipline pathways. Students can export their private record as JSON.
- A **University of Cape Coast digital certificate** is issued only when the learner identity is verified, the scored course assessment is passed and every activity marked required has passed evidence. The audit snapshot is stored with the award. Its genuine QR code opens the no-sign-in `/verify-credential` record, which checks live active, expired or revoked status.
- Facilitators receive governed **cohort intelligence** for only their own courses, including participation, completion, average scores, pass rates and evidence queues.
- Administrators receive institution-wide analytics plus a searchable **Credential Registry** with a recorded reason for every revocation and a controlled restoration action.
- The administrator **Restricted Danger Zone** previews the exact account-reset scope and requires both an acknowledgement and the typed phrase `DELETE ALL REGISTERED ACCOUNTS`. It permanently removes learner/facilitator profiles, non-admin sign-ins, identity evidence and personal learning/credential records; preserves administrator accounts and institutional course content; revokes deleted users' sessions; and records the action in the administrator audit log.
- Commercial role-selection, sign-in, registration, learner, educator, administrator and verifier experiences share one responsive product design and remain usable on desktop, tablet and mobile.
- Virtual laboratories use recognisable workbenches, apparatus, instrument panels, clinical stations, observations and practical reports so the learner experience resembles a real guided laboratory workflow.

### Student registration and access

1. From the public portal selector, choose **Register as a student**.
2. Create a password-protected account using a long-term email address.
3. Add education, occupation, organisation, learning interests, preferred language and any accessibility support needs.
4. Upload an accepted identity document and take a current selfie using the browser camera.
5. Review the supplied information and submit it for an authorised identity decision.
6. After approval, sign in through **Student Portal**. The internal access role remains `learner` for backwards compatibility, while all learner-facing product labels use **Student**.

The package is adapted for Render. It uses:

- Next.js on Node.js 22
- signed, HTTP-only login sessions
- salted `scrypt` password hashes
- SQLite for application records
- protected filesystem storage for uploaded course and identity files
- a Render persistent disk mounted at `/var/data`

## Commercial course design and content workflow

1. In **Facilitator Portal → Course Studio**, define the market-facing title, code, category, level, delivery pattern, expected hours, language, audience, prerequisites, accessibility commitment, enrolment mode and optional price marker.
2. Add at least two objectives and measurable outcomes. Each outcome must name its related skill and assessment method. Create one or more learner-facing syllabus sections.
3. Add learning blocks by writing/pasting text, supplying reviewed HTML, uploading a document/media file, converting a public web link, or keeping a link as a sandboxed embed. Map each block to a section and one or more outcomes.
4. Add required or optional Colab and virtual-lab evidence activities, then author scored assessment questions and map them to outcomes.
5. Save freely as a draft. The quality screen checks course identity, audience, objectives, outcomes, structure, outcome alignment, accessibility and assessment. Only a complete version can be submitted.
6. A system administrator reviews the submitted version and activates it. Learners see only active versions.

Automatic PDF extraction is best effort because PDFs may contain scanned pages, custom fonts or protected encodings. A low-text PDF is retained as the original and clearly flagged for facilitator correction or an accessible alternative. Modern `.DOCX` files can be converted; legacy binary `.DOC` files are retained as attachments and should be re-saved as `.DOCX` when readable conversion is required.

Public-link imports reject private, loopback and internal-network addresses, validate redirects, use time and size limits, remove executable markup and require the facilitator to confirm licence and attribution before publication.

## UCC certificate and QR verification lifecycle

The completion engine evaluates four governed evidence classes: active verified learner identity, a passing course assessment, every required virtual practical, and every required Colab notebook activity. Optional activities do not delay issuance. When all configured requirements pass, the enrolment is marked complete and one certificate is issued for that learner/course pair.

The certificate records the issuer as **University of Cape Coast**, the learner and course, the requirements snapshot, issue time and live governance status. Its QR encodes the full public verification URL using a standards-based QR matrix with error correction. Administrators can revoke or restore the record, and a scan always reflects the current registry status rather than a static image claim.

## 1. Upload to GitHub

1. Extract the ZIP file.
2. Create an empty repository on GitHub. Do not add a README or `.gitignore` there.
3. Open a terminal inside the extracted folder and run:

```bash
git init
git add .
git commit -m "Initial UCC microcredential platform"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

You can also use GitHub’s **Add file → Upload files** option and upload the extracted contents. Keep `Dockerfile` and `render.yaml` at the repository root.

## 2. Deploy with a Render Blueprint

1. Sign in to Render and connect your GitHub account.
2. Select **New → Blueprint**.
3. Connect the repository containing this package.
4. Render reads `render.yaml` and creates the Docker web service and persistent disk.
5. When prompted for `INITIAL_ADMIN_EMAIL`, enter the email address that should receive the first system-administrator account.
6. Confirm and deploy the Blueprint.

`AUTH_SECRET` is generated by Render automatically. Do not expose or change it after users begin signing in, because changing it signs out every active session.

## 3. Create the first administrator

1. Open the deployed `onrender.com` URL.
2. Select **System administrator**.
3. Choose **First admin setup**.
4. Register using the exact `INITIAL_ADMIN_EMAIL` configured in Render.
5. On first successful sign-in, that email is promoted to the initial administrator.

The administrator can then create facilitator invitations from the System Administration portal. Facilitators must register/sign in with the exact invited email address.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The SQLite database and uploads are stored under `.data/` locally.

## Free Google Colab workflow

1. A facilitator opens **Colab coding**, chooses one of their active courses, uploads a master `.ipynb` notebook, sets instructions, rubric, deadline, marks, pass threshold and permitted attempts, then publishes the assignment.
2. An optional GitHub `.ipynb` or Google Colab URL can open the notebook directly in free Colab. Without one, the learner downloads the template and uploads it from Colab's **File → Upload notebook** menu.
3. Each enrolled learner runs the notebook using their own Google account and free Colab allocation, then submits either the completed `.ipynb` file or a Google Colab/Drive sharing link.
4. For sharing-link submissions, the learner must grant the facilitator access or set **Anyone with the link can view**.
5. The facilitator downloads or opens the evidence, records a mark and feedback, and either completes the assessment or requests resubmission. The platform updates course completion after all active Colab assignments are passed.

There is no compulsory Colab charge for ordinary CPU notebook work; learners need an internet connection and a Google account. Paid Colab is only a learner-side option when heavier GPU or compute resources are required.

On Render, notebook templates and learner notebook submissions are stored below `DATA_DIR/uploads/colab-templates/` and `DATA_DIR/uploads/colab-submissions/` on the persistent disk.

### Add Colab and virtual-lab activities while designing a programme

The Facilitator Studio includes a dedicated **Programme activities** stage between learning materials and assessment. A facilitator can add an uploaded Colab notebook or an approved interactive virtual practical directly to the course sequence, then set whether it is required, its instructions, pass mark, permitted attempts, maximum mark, deadline and grading rubric.

When an administrator activates the course, configured Colab activities are automatically published to the learner Colab workspace. Virtual practical activities open the selected simulation from the active course. Both activity types remain visible in the academic approval record and learner course outline.

## Interactive virtual laboratories

The **Virtual labs** workspace provides guided practicals in general science, physics, chemistry, biology, nursing skills, medicine and engineering. Realistic science workbenches, engineering instrumentation benches and clinical simulation rooms appear throughout the catalogue and practical runner. Learners orient themselves in the room, identify apparatus through image hotspots, operate a live instrument console or complete a step-by-step clinical station, and record observations against a response diagram. Every practical follows nine controlled stages: objectives and pre-lab briefing, safety assessment, equipment identification, interactive simulation, pause-and-answer checkpoint, data collection, practical report or supervised evidence, facilitator grading, and debriefing with a competency record.

Facilitators can search and run every practical in **Facilitator preview mode** before including it in a programme. Preview mode follows the complete learner pathway but does not create a submission, mark or competency record. The same preview is available inside the Facilitator Studio's **Programme activities** stage, where a completed review is indicated before the practical is added to the course sequence.

These simulations complement rather than replace physical laboratories, clinical placements, supervised skills demonstrations or regulatory competency assessment. The medical and nursing scenarios use fictional patients and must not be used to diagnose, treat or prescribe for a real person.

Learners may attach an optional video, image or PDF evidence file up to 25 MB. On Render, these protected files are stored below `DATA_DIR/uploads/virtual-lab-evidence/` and are available only to the learner, the facilitator responsible for the linked active course, or a system administrator.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `AUTH_SECRET` | Yes | Signs secure login cookies; use at least 32 random characters |
| `INITIAL_ADMIN_EMAIL` | Yes | Email promoted to the first system administrator |
| `DATA_DIR` | Yes on Render | Database and protected-upload directory; configured as `/var/data` |
| `SQLITE_PATH` | Yes on Render | Explicit persistent database path; configured as `/var/data/ucc-microcredentials.sqlite` |
| `PORT` | Render-managed | HTTP listening port; the Blueprint uses `10000` |

## Data persistence and backups

The Blueprint attaches a 10 GB persistent disk. The database and every uploaded identity/course file are written below `/var/data`; only files under the disk mount survive deploys and restarts.

This is a single-instance architecture because SQLite and a Render disk are attached to one web service. Before serving a large institution or running multiple instances, migrate the database to PostgreSQL and uploads to private S3-compatible object storage.

Schedule regular disk snapshots or copy `/var/data/ucc-microcredentials.sqlite` and `/var/data/uploads/` to secure backup storage. National-ID and selfie files contain sensitive personal information and must be governed by UCC access, retention and data-protection rules.

## Security handover before public launch

- Configure a custom domain and HTTPS in Render.
- Replace the initial administrator password after handover.
- Add institutional email verification, password reset and rate limiting before unrestricted public registration.
- Keep the service on a paid plan with a persistent disk; free Render web services have ephemeral filesystems.
- Restrict administrator and facilitator accounts to authorised UCC personnel.
- Define retention and deletion rules for national-ID and selfie evidence.
- Review third-party learning materials, licences and transcripts before publication.

## Important service limitation

YouTube transcript extraction works only when YouTube exposes a usable caption track. Facilitators can always paste or upload `.TXT`, `.SRT` or `.VTT`, review it, and decide whether learners see the transcript.

## Useful Render documentation

- [Docker deployments](https://render.com/docs/docker)
- [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Persistent disks](https://render.com/docs/disks)
