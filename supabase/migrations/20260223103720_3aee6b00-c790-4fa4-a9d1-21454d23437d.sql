
-- Add 'inscrite' as a valid status for pre_inscriptions (no constraint exists, just documenting)
-- Add column to track conversion
ALTER TABLE public.pre_inscriptions 
ADD COLUMN IF NOT EXISTS converted_eleve_id uuid REFERENCES public.eleves(id),
ADD COLUMN IF NOT EXISTS converted_famille_id uuid REFERENCES public.familles(id);
