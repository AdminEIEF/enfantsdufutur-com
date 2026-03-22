
-- Drop the unique constraint to allow multiple matières per class per event
ALTER TABLE public.evenement_classes DROP CONSTRAINT IF EXISTS evenement_classes_evenement_id_classe_id_key;

-- Add heure columns for per-matière scheduling
ALTER TABLE public.evenement_classes ADD COLUMN IF NOT EXISTS heure_debut time;
ALTER TABLE public.evenement_classes ADD COLUMN IF NOT EXISTS heure_fin time;
