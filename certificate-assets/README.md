# UCC CoDE certificate template

This folder retains the approved landscape A4 HTML certificate template and its field names for institutional reference. The production application renders the same hierarchy in the learner wallet, adds the live UCC verification QR, and inserts the authorised digital signatures stored in the signature register.

## Authoritative University crest

The supplied approved raster crest is the single certificate crest source:

- Production application: `public/ucc_crest.png`
- Standalone certificate template: `certificate-assets/assets/ucc_crest.png`

The certificate renderer does not use an SVG fallback. Replacing the authoritative crest should therefore be a controlled institutional asset change rather than a template-specific substitution.

## Template fields

- `recipient_name`, `credential_title`, `credential_code`, `credit_value`
- `learning_mode`, `issued_date`, `credential_id`, `credential_status_label`
- `provost_name`, `facilitator_name`, `verification_url`, `qr_code_data_uri`
