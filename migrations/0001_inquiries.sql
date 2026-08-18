-- お問い合わせの帳面（教科書 第5章「受け取ることと取っておくことは別物」）
-- 適用: npx wrangler d1 migrations apply office-lifechange-contact --remote -y   （ローカル検証は --local）
CREATE TABLE IF NOT EXISTS inquiries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT    NOT NULL,            -- ISO 8601（UTC）
  name          TEXT    NOT NULL,
  company       TEXT,
  email         TEXT    NOT NULL,
  tel           TEXT,
  type          TEXT,
  place         TEXT,
  status        TEXT,
  timing        TEXT,
  message       TEXT    NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  turnstile     TEXT,                        -- ok / skipped / <error-codes>
  mail_status   TEXT,                        -- sent / failed:<status> / not_configured
  handled_at    TEXT                         -- 事務所側で対応済みにした日時（手動）
);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at DESC);
