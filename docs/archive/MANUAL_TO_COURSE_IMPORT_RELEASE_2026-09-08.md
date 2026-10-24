# UCC Manual-to-Course Import — Release 11

## Outcome

The Facilitator Course Studio now turns a searchable learning manual into a structured, reviewable course proposal. The import is deliberately governed: it creates an unsaved draft and distinguishes document evidence from machine suggestions and unresolved requirements.

## Facilitator workflow

1. Open the dedicated Facilitator Course Studio.
2. Select **Import learning manual**.
3. Upload a searchable PDF, DOCX, TXT, Markdown, HTML or RTF file no larger than 25 MB.
4. Review the extraction coverage, generated course structure and source evidence.
5. Select which groups to apply: Blueprint, Outcomes, Learning content and Assessment & credential.
6. Confirm the review acknowledgement and apply the proposal.
7. Complete the six Studio stages, review the original and converted lessons, confirm rights and accessibility, preview as a student, save the draft and submit it for UCC academic review.

## Extracted or proposed fields

- Course title, code, description and discipline
- Category, delivery pattern, competence level, language, workload, enrolment mode and price
- Intended audience and prerequisites
- Course objectives and measurable outcomes
- Skills and assessment-method alignment
- Syllabus sections and readable learning blocks
- Assessment modes, draft questions, marks, feedback and outcome mappings
- Pass mark, attempts, progression gate and UCC digital-certificate setting

## Assurance controls

- Role protection: only active facilitators and system administrators can call the import endpoint.
- Protected source: accepted manuals are stored under `course-manuals` in the configured protected upload area.
- Evidence labels: fields are marked Found in manual, Suggested, Review required or Missing.
- Traceability: extracted fields can display a source excerpt and confidence value.
- Selective application: facilitators may exclude any group and retain that part of the current editor.
- No auto-publication: import always resets the working version to a new unsaved draft.
- Accessibility hold: imported learning blocks remain unconfirmed until the facilitator selects Accessible during content review.
- Rights hold: copyright, licence, attribution and distribution permission remain explicitly unresolved.
- Specialist evidence hold: the importer does not fabricate Colab notebooks or virtual practicals.
- Scanned-document control: manuals without enough readable text are rejected with an OCR instruction.

## Technical changes

- `src/app/api/course-import/manual/route.ts` — authenticated upload, conversion and proposal endpoint.
- `src/lib/manual-course-import.ts` — deterministic extraction, classification, alignment and review metadata.
- `src/components/manual-course-importer.tsx` — three-stage upload, review and apply workspace.
- `src/app/page.tsx` — selective, alignment-safe proposal application to Facilitator Course Studio.
- `src/app/commercial-course-studio.css` — responsive commercial interface for the importer and applied-state banner.

## Validation

- TypeScript strict type check passes.
- Next.js 16.2.6 production build passes and includes `/api/course-import/manual`.
- ESLint passes with no errors; existing project warnings remain unchanged.
