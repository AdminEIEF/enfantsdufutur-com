-- Add per-level fee columns to niveaux
ALTER TABLE public.niveaux
  ADD COLUMN IF NOT EXISTS frais_inscription numeric NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS frais_reinscription numeric NOT NULL DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS frais_dossier numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frais_assurance numeric NOT NULL DEFAULT 0;