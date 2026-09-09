# UCC Microcredential Platform v13

## Self-enrolment release

This release makes self-enrolment the platform-wide policy for courses and programmes.

- All newly created courses are self-enrolment and free by default.
- All courses generated from an uploaded learning manual are self-enrolment and free by default.
- All existing database courses are converted to self-enrolment by a recorded one-time migration at startup.
- Students can inspect full course details and enrol immediately in free courses.
- A facilitator can optionally enable an enrolment fee. Paid enrolment is confirmed only after server-verified Paystack payment.
- A facilitator can independently make the UCC certificate free or paid. Academic completion is retained while a paid certificate awaits payment.
- The student credential wallet shows completed courses ready for free generation or payment and generation.

## Learning-manual course creation

The Course Studio can securely ingest PDF, DOCX, TXT, Markdown, HTML and RTF manuals up to 25 MB. It preserves the original file, extracts readable text and creates an editable draft with course identity, description, objectives, measurable outcomes, skills, sections, lesson blocks and starter assessment questions. Facilitator review and the existing academic approval gate remain mandatory.

## Deployment notes

No manual database edit is needed for the self-enrolment conversion. The first application start applies the migration to the persistent SQLite database and records it in `platform_migrations`.

`PAYSTACK_SECRET_KEY` is required only when at least one active offering charges an enrolment or certificate fee. Keep it in Render environment settings. The platform health endpoint reports a configuration problem when a paid active offering exists without the key.
