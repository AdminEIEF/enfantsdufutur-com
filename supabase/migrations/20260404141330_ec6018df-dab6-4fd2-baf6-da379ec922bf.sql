
-- Add new columns to pre_inscriptions
ALTER TABLE public.pre_inscriptions 
  ADD COLUMN IF NOT EXISTS adresse_transport text,
  ADD COLUMN IF NOT EXISTS uniforme_scolaire boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS uniforme_sport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS uniforme_scout boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS uniforme_karate boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nom_pere text,
  ADD COLUMN IF NOT EXISTS fonction_pere text,
  ADD COLUMN IF NOT EXISTS telephone_pere text,
  ADD COLUMN IF NOT EXISTS nom_mere text,
  ADD COLUMN IF NOT EXISTS fonction_mere text,
  ADD COLUMN IF NOT EXISTS telephone_mere text,
  ADD COLUMN IF NOT EXISTS enfants_supplementaires jsonb DEFAULT '[]'::jsonb;
