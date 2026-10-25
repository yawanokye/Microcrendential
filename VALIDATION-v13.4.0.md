# Validation: UCC Growth+ v13.4.0

Validated on 24 October 2026 using Node 22.23.4 and a local production standalone server. The implementation starts from the verified v13.3.2 source. Tests use isolated SQLite databases and synthetic accounts, with live provider credentials removed.

| Check | Result |
| --- | --- |
| Production build and standalone asset preparation | Passed |
| TypeScript application and test checks | Passed |
| Lint | 0 errors, 42 existing baseline warnings |
| Unit tests | 115 passed, 0 failed, 3 skipped out of 118 |
| Source layout and required release files | Passed |
| Working lab facilitator and learner acceptance | 15 passed |
| Isolated JavaScript and Python runtime checks | 5 passed |
| Facilitator Studio API regression | 23 passed |
| Facilitator Studio browser regression | 14 passed |
| Commercial API and certificate regression | 46 passed |
| Commercial browser regression | 14 passed |
| AI diagnostics and signed mock LTI integration regression | 25 passed |
| Optional corporate assurance regression | 33 passed |
| Optional practical and skip regression | 7 passed |

The acceptance suites total **182 passing checks**. The three skipped unit tests require CHOWN, SETUID and SETGID capabilities unavailable in this workspace. They concern mounted-storage ownership repair and unprivileged backups. They are not counted as passes.

## Working labs and Python

Production browser checks exercised authoring a lab, running it in learner preview, applying and undoing the change, saving it as optional, invalidating confirmation after an edit and displaying gaps in assessed outcome evidence.

All five lab types produced calculated results with actual working inputs. Learner drafts recovered after refresh on a 390-pixel phone viewport without horizontal page overflow. Evidence arrived in the marking queue with a pending status and no client-awarded mark. Required evidence blocked the final assessment until an authorised facilitator recorded a pass. Unassigned marking and incomplete forged evidence were rejected.

Real Python executed inside a lesson using the platform's bundled interpreter. NumPy and pandas calculated a dataset total of 250 and printed the actual records. An infinite loop was terminated, corrected code ran afterwards, and the exported Jupyter notebook contained the learner's code. The isolated runtime tests separately checked JavaScript execution, opaque origin, Python output, NumPy/pandas, blocked non-runtime network requests and Python timeout enforcement.

The build verifies the required Python asset set, package versions, byte counts and SHA-256 hashes. The application serves only allowlisted bundled runtime files through the Python asset endpoint. Learner code executes in a browser worker, never through server-side Python execution.

## Existing behaviour retained

Regression checks covered the five native interactive activity formats, protected answer keys, saved AI requests, correction of invalid generated answers, reusable activities, gradebook decisions, learner progress, certificate PDF downloads, corporate controls disabled by default and the ability to submit a complete course without a separate practical.

The LTI regression used a signed mock tool to test launch, content selection, score return, completion gating, replay rejection and private gradebook evidence. Corporate checks covered the selected identity, camera, workplace, oral and competency requirements. None of these controls becomes mandatory merely by installing the update.

## Limits and deployment checks

This is local production validation. No Render deployment or GitHub push was performed. Live AI course generation, a customer's H5P/LTI account, Colab, external cyber ranges, real payments and external email were not exercised. Successful mock LTI tests do not establish that a customer's external tool is configured correctly.

Native labs are intended for small datasets and bounded calculations. The cybersecurity workspace analyses supplied logs. The scientific workspace supplies an ideal model and measurement analysis. Physical competence, operating-system labs, network ranges and heavy GPU work need suitable supervised or specialist environments.

Text and JSON evidence is retained under `validation/course-development-v13.4.0/` and `validation/working-labs-v13.4.0/`. Browser screenshots and generated test PDFs were used only for internal inspection and are excluded from the release package.

Before promoting the update, upload the complete source and bundled Python assets, build on Node 22, retain the existing persistent disk and perform a deployment smoke check of sign-in, one working Python lab, evidence marking and the existing certificate download. See `WORKING-LABS-v13.4.0.md` for the exact workflow and principal modified files.
