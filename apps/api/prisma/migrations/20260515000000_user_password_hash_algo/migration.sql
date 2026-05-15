-- Tracks which hashing algorithm produced the value stored in
-- users.password_hash. New rows default to argon2; legacy rows imported from
-- the old system can be marked as md5 so the login path knows to verify
-- against an unsalted MD5 hex and lazily rehash to argon2 on first success.
CREATE TYPE "password_hash_algo" AS ENUM ('argon2', 'md5');

ALTER TABLE "users"
  ADD COLUMN "password_hash_algo" "password_hash_algo" NOT NULL DEFAULT 'argon2';
