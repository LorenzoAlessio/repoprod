-- MirrorChat — Schema Supabase
-- Esegui questo script nel SQL Editor di Supabase Dashboard
-- (https://supabase.com/dashboard → tuo progetto → SQL Editor → New query)

-- Tabella utenti
CREATE TABLE IF NOT EXISTS users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella contatti di emergenza
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  surname      TEXT NOT NULL DEFAULT '',
  relationship TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL,
  priority     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Indice per ricerche veloci per user_id
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);

-- Row Level Security: il server usa service_role_key quindi bypassa RLS,
-- ma è buona pratica abilitarla per sicurezza.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
