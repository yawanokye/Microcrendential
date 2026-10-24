# Optional corporate assessment assurance

This release adds native employee identity and competency controls inspired by the Kanokware-style workflow discussed. It does not connect to a separate Kanokware service. These controls add evidence for a facilitator's judgment; they cannot guarantee that a learner received no outside help.

## Facilitator choice

Open **Facilitator Course Studio → Assessment → Optional corporate assessment controls**. Every new course and every legacy course starts with these controls off. The master switch only reveals the settings. Each feature requires its own selection, and the facilitator can select any combination appropriate to the course. Saving a draft does not bypass normal academic approval or revise existing enrolment snapshots.

| Optional control | Result when selected |
| --- | --- |
| Employee registration | The teaching team must link the enrolled learner to the employer register before starting. |
| Facilitator identity check | An authorised facilitator records the method, notes and identity decision before the employee starts. |
| Prompted webcam checkpoints | The employee explicitly opens the camera and captures two prompted images. A human reviewer checks the evidence before credential release. |
| Random question selection and order | An attempt uses a saved selection from the approved question bank. Refreshing preserves it. |
| Random answer choices | Each attempt's option order is saved. Matching questions keep usable choices while answer keys remain private. |
| Assessment time limit | A server deadline limits the attempt. The facilitator may grant a recorded extension for an interrupted timed assessment. |
| Browser and connection event recording | Focus changes and online/offline events support contextual review. They do not automatically fail the learner. |
| Workplace task | An applied response or private evidence file requires a facilitator mark against the approved rubric. |
| Oral verification | The facilitator arranges an HTTPS meeting and records the employee's explanation and decision. |
| Individual competency decisions | Every selected outcome must meet its own threshold. A high overall quiz score cannot compensate for an unmet critical outcome. |
| Final facilitator verification | The credential remains pending until an authorised reviewer approves the session. |

Turning these controls off leaves the existing learner course workflow in use, with no corporate session or camera request. Existing platform identity and award requirements still apply. H5P/LTI activities and AI assistance also remain optional authoring tools; enabling corporate controls does not enable or configure them.

## Employee journey

The employee sees the selected evidence and resource rules before starting and acknowledges them. The server binds the active attempt to the signed-in employee and a saved browser key. Answers and the selected question snapshot survive refresh. A second browser cannot silently take over. If a browser is lost, the facilitator records a reason and releases the attempt before a fresh permitted start.

Camera access begins only after **Open camera checkpoint**. Two frames are saved after the employee follows a prompt, then the camera stream stops. This is human-review evidence, not automatic facial recognition, face matching or guaranteed liveness. The normal course page never requests camera permission. When a checkpoint is due, the employee must complete it before continuing or submitting. A missing required task or camera checkpoint cannot be bypassed by posting directly to the final-assessment API.

Employees can enter a workplace response or attach PDF, DOCX, TXT or common image evidence up to 2 MB. They can also record explanations for interruptions. The oral meeting uses the institution's chosen meeting service; recording the meeting or automatically judging speech is not part of this release.

## Review and employer report

Open **Facilitator Portal → Assessment marking → Corporate assessment and employee verification**. Select a course assigned to you. The teaching team manages enrolled employee registrations. Only staff with marking permission can access private evidence or publish verification decisions. Course moderation alone does not grant marking permission.

Review the workplace task, camera evidence, oral explanation and each required competency. Record meaningful feedback. Stale concurrent reviews are rejected rather than overwriting another reviewer's decision. The history records the actor, reason and change. A selected verification gate keeps the credential pending until all requirements pass for the same passing assessment session. A later negative review sends an issued credential for review. After the evidence is corrected, an administrator must resolve that credential review before restoring validity. A facilitator cannot restore a flagged credential, and an administrator cannot restore it while selected requirements remain unmet.

Use **Request updated verification evidence** to return a submitted session for follow-up without replacing its existing quiz grade. A supervised camera alternative can be recorded with its method, reviewer and reason, for example an agreed private in-person check. The alternative replaces the selected camera requirement for that session and is visible in its history. It does not waive the other selected requirements.

**Download corporate competency report** exports a CSV for enrolled employees, with organisation, employee number, identity method, assessment result, competency status, review decisions and interruption counts. CSV values are protected against spreadsheet formula execution. The report is available to authorised course staff for employer reporting; it does not grant employers a new public dashboard or share employee photos automatically.

## Evidence and practical limits

- Camera images and workplace attachments are private, require authentication and are served without caching. Other employees cannot retrieve them. Evidence access is audited.
- The facilitator selects a file-retention period of 1–90 days. Signed maintenance removes expired files; review decisions and audit records remain. Institution-managed backups retain their separate backup policy and may contain earlier files until those backups expire.
- Identity notes should describe the method and outcome. Keep national ID documents in the existing restricted identity register, not free-text notes.
- Browser events and snapshots do not prove misconduct. A facilitator must review circumstances and agreed adjustments. There is no automatic dismissal, employment decision or misconduct finding.
- Live AI diagnostics and a real H5P tool connection still require the organisation's provider credentials and deployment settings. The existing LTI 1.3 grade-return path is retained; simple iframe embedding does not become a graded integration.

Suggested initial use is a small approved corporate pilot with the workplace task, oral explanation and individual competency thresholds. Add camera evidence only where the facilitator determines that it is appropriate and provides a supervised alternative where needed.
