
-- Replace single filiation with two fields
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS nom_prenom_pere text;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS nom_prenom_mere text;
ALTER TABLE public.eleves DROP COLUMN IF EXISTS filiation;

-- Add mois_concerne to paiements for tracking which month a scolarité payment covers
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS mois_concerne text;
