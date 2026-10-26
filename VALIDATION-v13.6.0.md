# Validation, UCC Growth+ v13.6.0

Validated on 25 October 2026 using Node 22.23.4 and local production standalone servers. The starting source was v13.5.0. Academic records, roster entries, organisation contracts, receipts and signatures were synthetic. Real AI, email and payment credentials were removed from acceptance environments. Payment and LTI tests used local mocks.

| Check | Result |
| --- | --- |
| Production build and standalone assets | Passed |
| Application and test TypeScript | Passed |
| Lint | 0 errors, 42 existing baseline warnings |
| Unit tests | 145 passed, 0 failed, 3 skipped, 148 total |
| Source paths and required modules | Passed |
| Catalogue, employee access and finance production API/browser checks | 22 passed |
| Full programme delivery API/browser regression | 23 passed |
| Commercial API and certificate regression | 46 passed |
| Facilitator Studio API regression | 23 passed |
| Corporate assurance regression | 33 passed |
| Signed mock LTI and AI diagnostics regression | 25 passed |
| Working Python/data lab production regression | 15 passed |
| Facilitator Studio browser regression | 14 passed |
| Commercial browser regression | 14 passed |
| Optional practical and skip regression | 7 passed |

Production acceptance totals **222 passing checks**. The three skipped unit tests concern pre-existing mounted-storage ownership repair and unprivileged backup operations. This workspace lacks CHOWN, SETUID and SETGID capabilities. Skips are not counted as passes.

## Catalogue and organisation access

The anonymous catalogue and public homepage expose all four learning routes while omitting private employee training and programme-only module listings. Signed-in approved employees can discover the private course and programme. Another learner with the same employer entered in their profile and unassigned staff cannot discover them through direct catalogue queries. Access is filtered before pagination.

Only administrators can create organisations, verify rosters or change fixed fees. Assigned facilitators can author for their groups, but cannot release previously private training to the public. Employee revocation and expiry block new enrolment, lesson/assessment access and new programme registration. Existing earned credentials and personal programme records remain available to their holder.

Private course certificate verification returns status without learner or training details. Anonymous private certificate PDF download is blocked. Existing public credential PDF and verification behaviour continues to pass regression checks.

## Fees and funding

Tests verified fixed group pricing versus per-participant pricing, unique receipt references, partial funding, over-allocation rejection and fully funded named places. A client’s claim of organisation payment cannot bypass funding checks. Individual checkout is rejected when the administrator assigned the fee to the organisation.

A local mock provider received the server-held individual amount despite a conflicting client amount. After the administrator changed the published fee during checkout, settlement preserved the original tuition and certificate fee schedule. Unit checks also confirm that legacy enrolments without curriculum snapshots are pinned before a new fee schedule is applied.

An admitted learner paid programme tuition through a programme-specific order, obtained financial clearance, paid a programme-only course fee and then registered the course. Course payments cannot clear an identically coded programme fee. Programme checkout checks academic access and registration restrictions before creating a module payment order.

Academic completion alone did not release a certificate with an unfunded organisation-assigned certificate fee. After the verified receipt was allocated, background maintenance created the authorised course certificate. Programme automatic and registry-release certificates, semester GPA/CGPA, private transcripts, result correction, review, revocation and restoration passed the existing programme regression suite.

## Interfaces and existing delivery

The public route cards and full-degree filter were exercised in Chromium. The administrator selected a saved offering, viewed the fixed fee and payer controls, selected the organisation and viewed funded invoices and roster controls. The administration screen was checked at a 390-pixel mobile width without page overflow or browser errors. Invoice tables scroll within the screen. Browser screenshots and academic PDF fixtures were retained only for internal inspection, not included in this release package.

Existing facilitator draft review, saved AI requests, all five native interactive activities, mock LTI launch and grade return, corporate assurance, human marking, real Python/NumPy/pandas exercises and practical skip workflows passed regression checks.

## Limits of this validation

No GitHub push, Render deployment, real fee collection, bank verification, live AI generation or customer H5P account was used. Real providers still require institutional configuration and acceptance. Organisation receipts are administrator-confirmed finance records, not an automatic bank reconciliation service. Institutional admissions, accredited curricula, grading rules and award authorisation remain institutional decisions.

See `validation/catalogue-v13.6.0/` for the text acceptance results and `CATALOGUE-FUNDING-v13.6.0.md` for setup and upgrade instructions.
