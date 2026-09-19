# Structured learning activities, broader credentials and scanned/PPT import — 2026-09-19

## Facilitator learning activity completion controls
The learning-content edit dialog now includes a structured **Learning Activity & Section Completion** panel. Facilitators can configure:
- whether the learning block includes a graded activity;
- required vs optional completion gate;
- response format (short text, long response, image/drawing/chart, file, or evidence link);
- grading mode (rule based, automatic Luna/Terra routing, Luna, or Terra);
- pass mark, maximum mark and attempts;
- approved correct-answer rules for deterministic marking; or an approved rubric for AI grading;
- learner feedback and improvement guidance.

A required activity cannot clear the section until it is passed and feedback is recorded.

## Broader credential consolidation
A broader credential is not rebuilt as a standalone duplicate course. Its component microcredentials must exist and be active first. The Studio then:
- selects at least two existing active component microcredentials;
- defines broader objectives and outcomes;
- maps component outcomes to broader outcomes;
- references the live approved component curriculum, activities and assessment evidence;
- prevents nested broader credentials from being used as components;
- recognises previously earned component credentials in learner progress;
- keeps the “Part of …” relationship in the learner portal / Skills Passport, not on individual certificates.

## PDF and PowerPoint extraction
Manual/course-content import accepts PDF, PPT, PPTX, DOCX, TXT, Markdown, HTML and RTF.
- Machine-readable PDFs are extracted locally.
- Scanned/image PDFs fall back to GPT-5.6 document extraction.
- PPTX slide text and available speaker notes are extracted locally first.
- Image-only PPTX and legacy PPT fall back to GPT-5.6 document extraction.
- Extracted content always enters an editable facilitator-review workflow before learner publication.

## Validation
- TypeScript/TSX syntax transpilation: 152 files, 0 syntax diagnostics.
- Structured activity editor controls: static check passed.
- Compulsory feedback gate: static check passed.
- Broader credential live-component reuse: static check passed.
- Active component credential requirement: static check passed.
- PDF/PPT/PPTX upload UI: static check passed.
- Scanned/image AI fallback: static check passed.
- Local PPTX extraction smoke test: slide text and speaker notes extracted successfully.

A full `next build --webpack` still requires the dependency installation performed by the deployment environment.
