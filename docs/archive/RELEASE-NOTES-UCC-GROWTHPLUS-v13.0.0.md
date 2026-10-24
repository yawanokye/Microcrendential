# UCC Growth+ v13.0.0 - commercial delivery

This release turns the learner and facilitator delivery areas into workflows backed by saved records. It builds on the corrected v12.2.2 Render release and retains its mounted-storage entrypoint, liveness endpoint, backups, Google OAuth mail settings and full-functionality acceptance mode.

## Learner experience

- Real course progress, completed enrolments and resume links derived from saved evidence.
- Permanent course and lesson addresses, inline reading/video content, saved scroll position and accessible controls.
- Saved assessment and activity responses, private notes, bookmarks and resumable registration biodata.
- Basic-profile registration with personal or professional email. The approved course sets identity review before learning or before the award.
- Submission receipts and pending, processed or human-marking states. AI failures retain the submitted evidence.
- Assessment answers, feedback, decision history and an appeal workflow.
- Course discussions and replies, real live sessions and recordings, calendar downloads and reminder preferences.
- Support tickets with reply history, verified-payment PDF receipts and refund requests.
- Course evaluations and a readable achievement requirements record.
- Direct landscape certificate download with the course code as filename. Existing full preview, embedded crest/partner branding, signature and verification controls remain available.

## Facilitator and administrator experience

- Gradebooks with learner progress, engagement, final results, required evidence, appeals and evaluations.
- Paged marking queues for lesson, Colab and virtual-practical evidence, secure original-file downloads and rubric-based decisions.
- Teaching priorities for pending and overdue marking, unanswered discussions and inactive learners.
- Co-facilitator, marker and moderator assignments, enforced at the API. Only owners and administrators manage teams and create separate intakes.
- Separate offering codes, enrolment closing dates and capacity controls. Cohort membership and filtered CSV exports.
- Live-session scheduling, recordings, staff-recorded attendance, announcements and discussion moderation.
- Server-side Course Studio recovery, unsaved-change warnings and retained academic approval controls.
- Approved delivery settings for marking mode, deadlines, feedback targets, identity timing, attendance, practical requirements and refund terms.
- UCC-to-Anovlad monthly usage reconciliation with distinct learners, a configurable contractual definition/rate, test-account exclusions, CSV export and immutable monthly snapshots.

## Evidence and deployment safeguards

- Final submissions and supported practical evidence are saved before grading. Durable jobs support recovery, retries and manual decisions.
- Automatic, human and assisted final marking. Assisted scores remain drafts until a marker publishes the decision.
- Correcting a grade downwards recalculates the current result. Invalid issued awards and dependent stacked credentials move to an authorised review queue.
- Participation and attendance awards use their configured requirements. Future attendance cannot count towards completion; relevant attendance corrections also trigger credential review.
- Enrolments retain their approved curriculum snapshot. New revisions affect future enrolments, and separate intakes keep their learner evidence separate.
- Additive SQLite migrations preserve existing records. Course lists and evidence queues are paged, and permanent course links retrieve their course directly.
- Authenticated background maintenance processes grading, reminders and optional notification emails without blocking server startup.

See `COMMERCIAL-DELIVERY-RUNBOOK.md` for setup, upgrade and acceptance instructions, and `VALIDATION-2026-10-07-v13.0.0.md` for completed checks and remaining acceptance work.
