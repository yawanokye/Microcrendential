# UCC Microcredential Platform — Integrated recommendations update

Date: 19 September 2026

This revision combines the approved learner, facilitator, assessment, credential-stacking and certificate-branding changes into one deployable source tree.

## 1. Activity-gated section completion

- Course Studio activities can be attached to a specific section.
- Required section activities prevent the section from showing **Completed** until the learner has a passing assessed submission and feedback has been recorded.
- The learner portal shows the activity state, configured pass mark, permitted attempts and returned feedback.
- Required activities are also part of the final course/certificate completion evaluation.
- Completed learning content and passed activities remain recorded on subsequent visits.

## 2. Automated assessment and feedback

- Facilitators set the pass mark for the course assessment and for each configured learning activity.
- A configured pass mark is applied exactly. For example, with a 60% pass mark, 59% fails and 60% passes; no upward rounding creates a pass.
- Objective/deterministic items are graded by rules.
- Rubric-based/open-response items can be graded automatically using GPT-5.6 Luna, GPT-5.6 Terra, or automatic Luna/Terra routing.
- Luna is the default high-volume model; Terra is selected for explicit Terra mode or more complex responses in automatic routing.
- AI grading is constrained by the facilitator-approved question, model answer/key points, maximum mark and rubric. It returns structured criterion-level feedback.
- AI results without learner feedback are rejected.
- Deterministic questions return facilitator feedback when supplied and safe default feedback when no custom message is supplied.
- There is no default "borderline human review" rule. Human/facilitator marking is used only when that activity is configured for facilitator marking or for an authorised record correction.

### Prompt caching

For repeated grading of the same approved question and rubric, the stable question/rubric instructions are placed before an explicit GPT-5.6 prompt-cache breakpoint and use a stable `prompt_cache_key`. The learner response is placed after the breakpoint. This allows repeated static instructions to benefit from prompt caching without reusing any learner answer or grade.

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_ASSESSMENT_LUNA_MODEL=gpt-5.6-luna`
- `OPENAI_ASSESSMENT_TERRA_MODEL=gpt-5.6-terra`
- `ASSESSMENT_AI_TIMEOUT_SECONDS=90`

## 3. Broader / stacked credentials

- A facilitator can record an optional broader credential code, title and the explicit list of required component microcredential course codes.
- The relationship is shown in the learner portal and Skills Passport as **Part of: [broader credential]**.
- The relationship is not printed on the individual component certificate.
- Progress is calculated only from the explicit approved component list; the previous discipline-based inference is not used.
- When all required component credentials exist as active verified credentials for the learner, the platform creates the broader credential record once.
- The broader credential is separately verifiable and cannot be duplicated for the same learner/code because the credential register enforces one record per learner and credential code.

## 4. Authoritative UCC certificate crest

- The supplied PNG crest is now the authoritative production certificate crest at `public/ucc_crest.png`.
- The same exact PNG is retained at `certificate-assets/assets/ucc_crest.png` for the standalone certificate template.
- The previous production `public/ucc_crest.svg` fallback has been removed.
- The production certificate component now references `/ucc_crest.png`.

## 5. Existing usability improvements preserved

This update keeps the earlier rich-content authoring, facilitator preview/edit workflow, question preview/approval gate, learner-visible section notes, hidden internal AI-draft labels, persistent completion indicators, Previous/Next/jump navigation, and the one-certificate-per-course rule.
