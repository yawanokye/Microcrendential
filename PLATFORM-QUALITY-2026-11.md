# Platform quality and recovery

This update keeps existing courses, enrolments, payment records, certificates and access rules. New corporate assurance controls remain optional. Published course and programme changes still follow academic approval.

## Before deployment

Back up the existing database and uploads. Verify a restore into an isolated environment. Preserve the existing Render disk and secrets. Apply the complete source tree. The additive database migration creates payment-seat reservations, payment fulfilment fields and an adjustable library per-user limit. Existing payment records are marked `untracked` rather than being automatically enrolled or changed.

The acceptance environment now pauses **new online checkout and new official course, stacked and programme credentials**. It does not disable learning or invalidate existing credentials. Existing Paystack callbacks and verification requests remain available when payments are enabled, so payments already started can be recorded. An institution may explicitly authorise an acceptance exception by setting `DEMONSTRATION_ALLOW_OFFICIAL_CREDENTIALS=true` and/or `DEMONSTRATION_ALLOW_PAYMENTS=true` in Render. Set these only after the appropriate internal decision. The defaults are false.

Official Pilot activation requires the readiness panel, including an active administrator, support and monitoring configuration, recent backup, recorded offsite recovery test and appropriate signatories. Official credential issuance and new checkout are paused if pilot readiness subsequently fails. A configured monitoring URL is a configuration check, not proof that alerts are reaching a person. The recovery entry is an administrator attestation and does not itself transfer or restore a backup.

## Payments and awards

Limited-capacity courses hold a place for 15 minutes while a checkout is initiated. Holds and orders are recorded atomically. A late payment is always recorded as paid, even when the hold has expired. When enrolment cannot be completed, the payment stays pending, appears in payment history and is retried by maintenance and on request. An administrator or the learner can retry. Refund requests pause the pending enrolment. A refund is processed only through the existing authorised provider and UCC workflow.

All course awards, including attendance and CPD participation, require the active learner's verified identity. UCC, partner and optional academic-lead signatures must be available when applicable before a new award is created. Existing credentials are not deleted or automatically revoked. Registry staff should review any historical awards of concern rather than assuming they were invalid.

## Course design and library

Facilitators can optionally require earlier required lessons to be completed in order. The progress flag records an action and is not proof of identity or understanding. Use an appropriate assessment and, when selected, the existing corporate verification options for stronger assurance.

Uploaded content and generated manual extracts no longer receive an automatic accessibility-review confirmation. Facilitators confirm accessibility after review. Video blocks also need a reviewed published transcript. Existing published course snapshots are not silently rewritten.

Public catalogue search, counts and pagination run on the server. Private organisation offerings remain excluded from public results. The signed-in library has separate configurable institutional and per-account provider-call limits and paged results. Its sources remain limited to the configured providers and their licences. Facilitator resource suggestions require a reported open-access link and display a reuse-rights reminder.

Saved AI course requests continue through the existing maintenance process even if the facilitator closes the designer. An institution-wide daily authoring-call allowance complements the per-facilitator limit. Defaults are 150 and 30 calls respectively. These are call allowances, not monetary spending guarantees. OCR, other AI features, provider billing and external tools are separate. If a running process is lost, retry remains an explicit owner action to avoid an unknown repeated provider charge.

Programme transcript downloads include individual released attempts with their recorded release dates. The existing latest-released-result GPA policy is unchanged. The data does not record the actual semester of a resit, and older aggregate-only records may not have individual attempts. The UCC registry must confirm transcript content, grade bands, resits, recognised credits and award rules before using these records as the authoritative institutional transcript.

## Encrypted offsite backup procedure

Automatic archives remain on the persistent disk. This update does **not** configure an offsite storage provider or automatically copy backups offsite. Render disk encryption and the export encryption serve different purposes. Keep a separately protected 32-byte key in `BACKUP_ENCRYPTION_KEY_BASE64`. Never put the key in GitHub or in the same location as the offsite archive. Retain a secure recovery copy of the key.

With the latest verified archive available on the server, use the supplied commands with concrete paths:

```sh
npm run backup:encrypt -- /var/data/backups/ARCHIVE.tar.gz /var/data/backups/ARCHIVE.tar.gz.enc
```

Transfer the encrypted file to the institution's approved offsite storage using its approved method. Regularly restore a copy into an isolated location using the same key:

```sh
npm run backup:decrypt -- /secure/ARCHIVE.tar.gz.enc /secure/restored.tar.gz
npm run backup:verify -- /secure/restored.tar.gz
```

Decryption authenticates the encrypted archive before publishing its output and writes a checksum for the verification command. A restore exercise should also check representative uploaded files and application access, not merely the database integrity check. Record the date and internal evidence reference in the administrator readiness panel. Do not restore an exercise over the live database.

## Validation and external dependencies

Run `npm ci --include=dev`, `npm run pilot:check` and the relevant production API acceptance scripts with synthetic data. Live AI, H5P/LTI grade return, email delivery and Paystack sandbox checkout require the institution's real provider configuration and separate end-to-end verification. No new managed database, object storage, isolated cyber range or paid Render worker is provisioned by this update. Those require infrastructure selection, costing, credentials and a migration plan. A single disk-backed instance still has the associated availability and scaling limits.
