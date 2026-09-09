ALTER TABLE course_drafts ADD COLUMN certificate_fee_ghs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE enrollments ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'not_required';
ALTER TABLE enrollments ADD COLUMN payment_reference TEXT;
ALTER TABLE enrollments ADD COLUMN amount_paid_pesewas INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  course_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('enrollment','certificate')),
  amount_pesewas INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  provider TEXT NOT NULL DEFAULT 'paystack',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed')),
  provider_reference TEXT,
  provider_payload_json TEXT NOT NULL DEFAULT '{}',
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS payment_orders_user_course_idx ON payment_orders(user_email, course_code);
