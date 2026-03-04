
-- Add robotique_paye column to eleves
ALTER TABLE public.eleves ADD COLUMN robotique_paye boolean DEFAULT false;

-- Insert default prix_robotique parameter
INSERT INTO public.parametres (cle, valeur)
VALUES ('prix_robotique', '"500000"')
ON CONFLICT (cle) DO NOTHING;
