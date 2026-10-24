# Course Studio AI setup

The Course Studio supports three governed AI workflows:

1. **Review current course** — OpenAI recommends improvements to the current blueprint, outcomes, syllabus and assessment. The facilitator selects which groups to apply.
2. **Import a course manual** — the existing document extractor retains the original file and creates readable lessons. When OpenAI is configured, it strengthens the proposed course design. If OpenAI is unavailable, deterministic extraction still creates a draft.
3. **Start from an idea or synopsis** — OpenAI creates an unsaved course blueprint, draft learning blocks, resource-search prompts, activity suggestions, rubrics and assessment questions.

Gemini Flash analyses a public YouTube URL or an authorised `gs://` media URI and proposes a timestamped transcript, chapters, learning summary, accessibility notes and assessment questions.

## OpenAI task routing

The platform does not send every job to one model. It selects a model according to the facilitator's task:

| Workload | Default model | Course Studio use |
| --- | --- | --- |
| Fast | `gpt-5.6-luna` | Quick drafting, cleanup and field-level refinement selected by a facilitator. |
| Balanced | `gpt-5.6-terra` | Complete course generation from an idea/synopsis and enhancement of an uploaded manual. |
| Quality | `gpt-5.6-sol` | Rigorous academic review of outcomes, curriculum alignment and assessment before submission. |

The course-review control lets the facilitator select the desired depth. Manual and synopsis workflows automatically use the balanced route. Provider output remains subject to the same structured validation and human approval rules.

## Render environment variables

Set these only in the Render service environment. Never expose provider credentials through `NEXT_PUBLIC_*` variables.

```text
OPENAI_API_KEY=...
OPENAI_FAST_MODEL=gpt-5.6-luna
OPENAI_BALANCED_MODEL=gpt-5.6-terra
OPENAI_QUALITY_MODEL=gpt-5.6-sol
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_VERTEX_MODEL=gemini-3.8-flash
GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON_BASE64=...
```

For backward compatibility, an existing `OPENAI_COURSE_MODEL` value is treated only as the balanced-model override when `OPENAI_BALANCED_MODEL` is not set. New deployments should use the three explicit variables.

Create a narrowly scoped Google service account that can invoke Vertex AI. Encode its downloaded JSON locally before putting it into Render:

```bash
base64 -w 0 service-account.json
```

On systems without GNU `base64`, use an equivalent single-line Base64 encoder. Do not commit the JSON or encoded credential to GitHub.

## Governance and safety

- AI endpoints require an active facilitator or administrator account.
- Mutating requests use the platform's same-origin protection.
- Provider credentials remain on the server.
- AI output is validated against bounded structured schemas.
- Generated HTML is produced through the platform's safe Markdown-to-HTML converter.
- External-resource recommendations are search queries, not invented links. Facilitators must open and verify each result's relevance, licence, attribution and accessibility.
- AI output never publishes a course. Facilitator review, learner preview and UCC academic approval remain mandatory.
- Courses remain open for self-enrolment and free by default.

## Production controls to add in provider consoles

- Set monthly project budgets and billing alerts for OpenAI and Google Cloud.
- Restrict the Google service account to the required Vertex AI role and rotate credentials.
- Monitor the audit events `course.ai_design_generated`, `course.ai_idea_generated` and `course.ai_media_analysed`.
- Retain generated drafts and source material only for the institution's approved retention period.
