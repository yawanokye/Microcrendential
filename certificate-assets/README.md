# UCC CoDE certificate template

This folder retains the supplied landscape A4 HTML template and its field names for institutional reference. The application renders the same hierarchy in the learner wallet, adds the live UCC verification QR, and inserts the authorised digital signatures stored in the signature register.

Template fields:

- `recipient_name`, `credential_title`, `credential_code`, `credit_value`
- `learning_mode`, `issued_date`, `credential_id`, `credential_status_label`
- `provost_name`, `facilitator_name`, `verification_url`, `qr_code_data_uri`

The production UI uses `public/ucc_crest.svg` as a deploy-safe vector crest fallback. Replace it with the approved crest asset if your deployment policy requires the original raster artwork.
