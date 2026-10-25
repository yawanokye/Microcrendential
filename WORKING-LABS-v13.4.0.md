# UCC Growth+ v13.4.0: course development and working labs

This release builds on the verified v13.3.2 optional-practicals source. It adds working learner environments, a guided lab authoring process and an outcome evidence review. Existing course identity, pricing, certificate configuration, activities and enrolments remain in their existing storage model. No database migration is required.

Every new lab is optional. Facilitators choose whether to add one and whether its passing result is required for lesson completion. Courses without labs can still pass the lab quality check. The existing **No practical activity** and **Skip practical activities** paths remain available.

## What learners can actually do

| Workspace | Working capabilities | Scope |
| --- | --- | --- |
| Coding | Edit and run Python or JavaScript, change CSV data, inspect output, compare runs and submit code with reasoning | Browser execution, small datasets and bounded runs |
| Data science | Inspect and edit data, optionally import authorised CSV, calculate descriptive statistics, write Python using pandas and NumPy, interpret findings | Small tabular investigations |
| AI | Train a simple linear regression, use held-out test rows, inspect predictions and error metrics, change the data and compare models; optionally write Python | Introductory model experiments |
| Cybersecurity | Analyse supplied synthetic authentication logs, change alert thresholds, compare detections and write defensive analysis code | Evidence analysis with supplied data |
| Scientific experiment | Vary voltage and resistance in an ideal resistor model, record repeated trials, plot observations and fit a trend; alternatively analyse supplied measurements | Ideal simulation or supplied measurement analysis |

The virtual-practical navigation now says **Protocol practice**. These guided activities rehearse a procedure. The new working labs supply editable inputs and calculated outputs. Physical competence still depends on appropriate supervised assessment. Operating-system exercises and network security ranges need a separately configured environment. Large datasets, GPU training and packages beyond the bundled Python set can use the existing Colab or registered external-tool path.

## Facilitator workflow

1. Define audience, outcomes, resources, workload and evidence in the course brief. The AI brief now includes teaching focus, learner tools and the practical evidence goal. Outline planning stays separate from lesson generation.
2. In **Build Content**, open **Create a working lab in a lesson → Plan, build and test a learning lab**. Select an existing lesson and a workspace template.
3. Edit the task, instructions, evidence requirements, dataset, language, starter code, marking rubric, outcome links and total lesson time. Dataset import and required completion start disabled.
4. Run the workspace in the learner preview. Check that the resources, calculations, evidence and rubric fit the intended outcomes. A change to the plan invalidates the previous preview confirmation.
5. Apply the lab to the lesson. Replacing an existing activity requires an explicit selection. **Undo last studio change** restores the previous lesson and activity. Save the draft to persist the change.
6. Use **Development review and outcome evidence** to inspect lesson coverage, approved questions, required evidence, optional practice and workload. Suggestions link to the relevant editing stage. Optional practice is displayed separately from assessed evidence.
7. Submit through the existing academic approval process. A selected working lab must have valid settings, a reviewed preview, lesson attachment, instructions and a human-marking rubric. A lab is never mandatory simply because the feature exists.

AI prompts now ask for teaching, demonstration, practice, feedback and transfer, with explicit tasks, resources, evidence and assessment criteria. They describe the actual available workspaces and their limits. Generated lesson content still needs facilitator review. This release does not claim that a live AI provider has successfully generated a course.

## Running Python

Python runs inside an isolated browser worker in the lesson. It does not execute on the application server. The release includes Pyodide 314.0.7 with Python 3.14.2, NumPy 2.4.6 and pandas 3.0.2, plus their bundled dependencies. Assets are served by the platform and checked against file hashes. Learners do not need a Google or AI account for native Python exercises.

The dataset is available as `data`, a list of records. Use `print()` for output and assign a JSON-compatible summary to `result`, for example:

```python
import pandas as pd

frame = pd.DataFrame(data)
print(frame.to_string(index=False))
result = {"rows": len(frame), "total": float(frame["cost"].sum())}
```

Learners can export the current CSV, lab record and an editable Jupyter notebook. Code, data, reflection and successful run history are saved through the existing lesson draft system. A refresh recovers the work. A timed-out run can be corrected and run again.

First use downloads the required runtime assets from this deployment. The complete bundled set occupies about 21.4 MB before HTTP compression. Python gets up to 60 seconds to initialise and five seconds to execute a programme. JavaScript has a 1.8-second execution limit. The interface provides a stop control. Limits are suitable for introductory tasks rather than long-running computations.

CSV inputs are limited to 60,000 characters, 1,000 rows and 24 columns. Code is limited to 20,000 characters. Run output is bounded and history retains the latest 12 runs. General network access, a system shell and arbitrary package installation are not provided. Browser memory availability also limits the size of a feasible exercise.

## Evidence and marking

Submitting work sends the code, dataset, run history and reflection to the existing evidence queue. The server validates the record structure and required evidence. It does not trust learner-reported results or marks as proof of execution. The authorised facilitator assesses the work against the rubric and supplies the mark and feedback.

A successful programme is practice feedback, not an automatic pass or proof of the learner's identity. When required completion is enabled, a passing authorised mark unlocks the relevant progression requirement. The existing optional corporate assurance controls can supply further identity, workplace-task and oral-follow-up evidence when selected by the facilitator.

## Files and deployment

Upload the complete extracted release to the existing GitHub repository root, preserving folders. Do not mix root `components/`, `app/` or `lib/` copies with the canonical `src/` tree. The earlier missing corporate-component deployment repair remains included. Keep the existing Render persistent disk and environment settings.

Principal additions and modifications:

| Area | Paths |
| --- | --- |
| Lab authoring and learner screens | `src/components/learning-lab-author.tsx`, `learning-lab-player.tsx`, `platform-home.tsx`, `src/app/learning-labs.css` |
| Lab models, validation and calculations | `src/lib/learning-labs.ts`, `python-lab-runtime.ts`, `structured-learning-activities.ts`, `course-design.ts` |
| Python execution harness and assets | `src/app/api/learning-labs/`, the complete `public/vendor/pyodide/` folder, `scripts/verify-python-runtime.mjs` |
| Course review and AI brief | `src/components/course-development-review.tsx`, `ai-course-designer.tsx`, `src/lib/course-development.ts`, `course-ai.ts`, `src/app/api/course-ai/design/route.ts` |
| Submissions and marking | `src/app/api/learning-activity-submissions/route.ts`, `src/app/api/courses/route.ts`, `src/components/delivery-workspaces.tsx` |
| Activity replacement | `src/components/lesson-studio-tools.tsx`, `external-activity-author.tsx` |
| Build, security headers and packaging | `next.config.mjs`, `eslint.config.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `.dockerignore`, `src/app/layout.tsx` |
| Verification | `tests/learning-labs.test.ts`, `scripts/seed-learning-labs-test.ts`, `test-learning-labs.mjs`, `test-lab-runtime.mjs` |

The bundled `public/vendor/pyodide/python_stdlib.zip` is an intentional runtime file. Its explicit exceptions in `.gitignore` and `.dockerignore` must be retained. Do not delete it as a leftover release archive. The build fails if bundled Python assets are absent, incomplete or changed.

Use Node 22.23.4:

```sh
npm ci --include=dev
npm run check:source
npm run pilot:check
npm start
```

Browser acceptance additionally needs Playwright and Chromium. `npm run test:labs` checks the production learner and facilitator journey. `npm run test:lab-runtime` checks isolated code execution directly. See `VALIDATION-v13.4.0.md` for the actual results and remaining deployment checks. No production Render deployment has been performed as part of this package.
