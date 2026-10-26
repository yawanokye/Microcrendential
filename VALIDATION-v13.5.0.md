# Validation, UCC Growth+ v13.5.0

Validated on 25 October 2026 against the local production standalone server on Node 22.23.4. The starting source was the verified v13.4.0 release. Provider credentials were removed from the isolated acceptance environments. All academic records and signatories used for testing were synthetic.

| Check | Result |
| --- | --- |
| Production build and standalone asset preparation | Passed |
| Application and test TypeScript checks | Passed |
| Lint | 0 errors, 42 existing baseline warnings |
| Unit tests | 134 passed, 0 failed, 3 skipped, 137 total |
| Required source files and route layout | Passed |
| Full programme production API and browser workflow | 23 passed |
| Facilitator Studio API regression | 23 passed |
| Commercial API and certificate regression | 46 passed |
| Corporate assurance regression | 33 passed |
| Signed mock LTI and AI diagnostics regression | 25 passed |
| Working lab production regression | 15 passed |
| Facilitator Studio browser regression | 14 passed |
| Commercial browser regression | 14 passed |
| Optional practical and skip regression | 7 passed |

The production acceptance suites total **200 passing checks**. Three unit checks were skipped because this workspace lacks CHOWN, SETUID and SETGID capabilities. They concern existing mounted-storage ownership repair and unprivileged backup tests. Skips are not counted as passes.

## Programme workflow

The tests created a complete degree curriculum through the API and a credit-bearing, two-semester certificate through the actual facilitator interface. They checked ownership, immutable approved versions, stale updates, academic approval references, valid dates, explicit certificate authorisation and optional settings disabled initially.

Mobile learners applied for admission and could not self-admit or bypass programme registration. Registry admission recorded student numbers, cohorts and references. Course fees remained payable until an explicit programme tuition clearance was recorded. Direct self-enrolment into programme-only courses was rejected. Prerequisites and term-release requirements used released platform results. Deferred learners could not register new courses or submit protected programme-only assessments.

Core courses, elective credit thresholds, an assessed capstone and recognised practicum credit contributed to completion. The recognition cap was enforced. Recognised credits were excluded from GPA. A later curriculum applied to new admissions while existing learners retained their admitted requirements and course snapshots.

Cross-site requests, oversized streamed JSON bodies, excessive course lists, unassigned staff access and another learner's record requests were rejected. The learner's grade, completion and fee-clearance fields could not bypass server decisions.

## Transcripts and certificates

Detailed transcripts included only registered or recognised courses, with semester GPA and cumulative GPA. A two-semester degree example produced semester GPAs of 3.500 and 4.000 and CGPA of 3.667. Its unused elective did not appear as a failed transcript course. A separate two-semester certificate produced semester GPAs of 4.000 and 3.000 and CGPA of 3.500.

The registry-release example created a degree certificate after the approved final award was recorded. The automatic example created its full programme certificate after the final semester mark was released and all configured credit and GPA requirements passed. A pending final result did not create a certificate. Background maintenance retained the same certificate identity on rechecking.

Certificate PDFs were downloaded from the production server. The degree certificate was a single landscape page with embedded crest and both registered signatures, plus a verification QR. Private transcript PDF and CSV downloads passed. Public verification returned the qualification and current status without student numbers, email addresses or marks.

A downward result correction flagged the award and certificate for review, blocked active certificate downloads and prevented restoration while requirements remained unmet. A changed final mark that still passed also required review. Authorised restoration and revocation were tested with recorded reasons.

PDF layout checks included the production certificate and transcript, and a separate eight-semester, forty-course transcript carrying 120 credits. All forty courses appeared once. All six rendered pages of the longer transcript were visually inspected, with repeating headers, semester totals and page numbers. The shorter production transcript fitted one page with its verification QR. These are internal layout fixtures, not live academic awards.

## Existing capabilities

Regression checks retained native interactive activities, saved AI proposals, course review, H5P/LTI launch and grade return, corporate assurance controls, learner progress, human marking, certificate downloads, programme intake capacity and the practical skip workflow. Working Python, NumPy and pandas calculations, timeout recovery and notebook export also passed against the production build.

The database change was tested as additive and idempotent. Existing standalone microcredentials keep their best-pass aggregate rule. Programme courses and programme transcripts use the latest released attempt. Pending work is not treated as a released zero mark.

## Deployment limits

No GitHub push or Render deployment was performed. No live AI generation, customer H5P account, external admissions system, institutional registry, real fee collection or accreditation service was contacted. LTI testing used a signed mock tool. The institution must supply its approved curriculum, grading scheme and certificate authorisation before real delivery.

Text and JSON evidence is retained in `validation/programmes-v13.5.0/`. Browser screenshots and generated test PDFs are excluded from this source package. Back up the existing deployment, upload the complete release, build on Node 22 and smoke-test admission, semester registration, transcript download and programme certificate verification before promotion.
