ALTER TABLE public.matieres DROP CONSTRAINT matieres_pole_check;
ALTER TABLE public.matieres ADD CONSTRAINT matieres_pole_check CHECK (pole = ANY (ARRAY['Littéraire'::text, 'Scientifique'::text, 'Expérimentale'::text]));
-- Update existing data to match new values
UPDATE public.matieres SET pole = 'Scientifique' WHERE pole = 'scientifique';
UPDATE public.matieres SET pole = 'Littéraire' WHERE pole = 'litteraire';
UPDATE public.matieres SET pole = 'Expérimentale' WHERE pole IN ('social', 'autre');