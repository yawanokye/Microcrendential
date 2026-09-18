# UCC Micro-credential Policy / Platform Alignment — 18 September 2026

## Implemented

- Added programme initiation source, originating unit, programme home, contributing units and identified-need metadata to Course Studio and course design records.
- Programme source is explicitly a record field only; it does not create a separate electronic approval workflow.
- Reframed the administrator approval screen as **Committee decision records & activation**.
- Added one-time committee/authority record fields: authority, decision date, minute/reference, decision, conditions, effective/review dates and document reference.
- Added programme-level certificate pre-authorisation at activation.
- Preserved immediate automatic certificate generation after a learner satisfies the approved completion, assessment, identity and applicable payment conditions. No learner-by-learner certificate authorisation step was added.
- Added approval record storage and audit data to course records.
- Added committee amendment record fields to controlled revisions of published programmes.
- Existing active certificate-enabled courses are migrated as certificate-preauthorised so the current learner experience is not interrupted.
- Governance records are not exposed in learner course API payloads.
- Added governance metadata quality checks and automated tests.

## Governance model

The platform records and enforces authoritative University decisions; it does not simulate committee voting or reproduce committee approval stages as separate clicks.
