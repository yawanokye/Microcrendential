# UCC Growth+ facilitator authoring update, v13.1.0

This release improves the existing application. It includes the complete source package, rather than files to paste into the repository root.

## Facilitator journey

1. Open Facilitator Course Studio and choose **Use AI assistance**.
2. Describe the audience, level, total learning hours, goals, delivery mode and award type. Supply an idea, manual or supported media source.
3. Generate the outline. Review the outcomes and edit the section titles. Choose **Approve outline and develop lessons**.
4. Review complete learning blocks, suggested outcome links, interactive practice, answer keys and feedback. Correct a mismatched multiple-choice answer or exclude its question. Confirm the lesson mappings before applying.
5. In **Build content**, choose a lesson in **Lesson AI and interactive practice**. Simplify it, add a Ghanaian workplace example, create practice, generate a rubric or convert it to an interactive activity. Review current and proposed text before applying selected changes.
6. Use **Build or reuse interactive practice** to edit knowledge checks, matching, sequencing, flashcards or decision scenarios with ordinary fields for prompts, choices, answers and feedback. Add, remove or reorder items without writing a special text format. Test the actual learner controls, save reusable activities and load them into other courses.
7. Use the existing lesson editor to set whether practice is required, its pass mark, maximum mark and attempt limit. Preview the full course, save the draft and submit through the existing academic approval process.

## What changed

- An invalid AI quiz answer stays unresolved. The system no longer chooses the first option. Publication validation still requires a valid, previewed and approved assessment.
- AI lesson mappings use explicit zero-based outcome indexes and a written rationale. Invalid indexes are ignored. The facilitator can correct the links and must confirm them.
- **Improve this draft** adds selected teaching blocks and questions. It preserves course identity, fees, certificate and delivery settings, governance, existing activities, assessment files, pass marks and existing question approvals. New questions require their own approval. To revise an existing block, use the lesson tools.
- Undo restores an earlier unsaved studio state, including its identity and settings. History clears after saving or opening another course. It is not a replacement for stored course versions.
- Blocks can be moved or duplicated. Duplicating a block also duplicates its linked activity with fresh identifiers.
- Native activities are editable records linked to lessons. Existing completion, evidence queues and the gradebook receive the server-assessed result and item feedback. Dragging is not required. Sequencing uses keyboard and touch buttons, matching uses selects and other choices use native controls.
- Practice is optional when generated. A facilitator can make it required in the lesson editor. Flashcards record review of the cards, so they should be used for practice or participation evidence. Final approved assessments continue to govern assessed credentials.
- AI requests and results are saved in SQLite. Queued requests resume when the owner returns. Completed course and lesson proposals can be reopened. Failed requests support explicit retry. A worker lost during generation becomes a failed request after ten minutes and is not silently rebilled.
- A facilitator's activity templates and AI requests are private. An administrator can set the daily request limit and inspect institutional usage. Provider token counts are recorded when available. Optional cost estimates use institution-configured rates and cover recorded successful responses, rather than providing an invoice.
- Verified exact source excerpts and the number of source characters analysed appear in the proposal. The first 90,000 source characters are analysed per request. This is excerpt verification, not automatic fact checking or page-level citation verification. Develop long source material in smaller lesson requests and check unsupported claims yourself.
- Outline placeholders and unconfirmed AI alignment block academic submission. Misplaced root copies of application source were removed. The source of record remains under `src`.
- Unassigned facilitators receive catalogue details without internal answer keys. Existing owner, course-team and administrator permissions remain available.
- Learner draft recovery no longer clears typed responses when initial status or saved-response requests finish.

## Deployment

1. Back up the existing persistent database and uploads using the current backup procedure.
2. Extract this ZIP. Upload the contents of `Microcrendential-master` to the GitHub repository root. Keep `src/components/...` and `src/app/...` in their directories. Do not upload individual component files to the repository root.
3. Keep the existing Render disk, `DATA_DIR`, `SQLITE_PATH`, `AUTH_SECRET`, payment and email configuration. No provider credentials or production data are included in this package.
4. Keep an existing AI provider configuration. OpenAI course authoring uses `OPENAI_API_KEY` and the model named in `OPENAI_COURSE_MODEL`. Vertex settings are documented in `AI_COURSE_STUDIO_SETUP.md`.
5. Optional defaults are in `.env.example`. `COURSE_AI_DAILY_LIMIT` defaults to 30 requests per facilitator per UTC day. An administrator's saved override takes precedence. Two concurrent requests per facilitator are allowed.
6. Optional `COURSE_AI_INPUT_USD_PER_MILLION` and `COURSE_AI_OUTPUT_USD_PER_MILLION` enable usage estimates. Use rates appropriate to the institution's configured providers. Leave them blank when rates are unknown or providers differ materially.
7. Run `npm ci`, then `npm run pilot:check`. Deploy through the existing Render workflow. The AI request and activity-library tables are created automatically without replacing existing courses or enrolments.
8. Check a manual course, outline generation with the configured provider, an existing draft improvement, a required native activity and a final assessment on staging before promoting the release.

## Validation and limits

The validation matrix is in `VALIDATION-FACILITATOR-STUDIO-v13.1.0.md`. Detailed results and screenshots are in `validation/facilitator-studio`. Unit tests use a simulated provider response to check normalization and durable requests. Production API tests use an isolated database and remove AI, payment and email provider credentials. Browser tests exercise facilitator controls and mobile learner practice against the local production server.

Live AI responses vary by provider and model. External AI generation, live email, live payment, Docker execution and the user's Render deployment are not validated by those local tests. The three existing storage tests require operating-system capabilities unavailable in this environment.

H5P, LTI and SCORM are not added in this release. Rich external activity integration remains a separate project requiring a configured external service, authenticated result exchange and tested progress/gradebook mapping. Ordinary embedded content should not be treated as recorded graded evidence.
