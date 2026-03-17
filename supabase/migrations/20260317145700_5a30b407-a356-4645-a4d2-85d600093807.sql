
-- Add signature column to bulletins_paie so it's accessible from employee space
ALTER TABLE public.bulletins_paie
ADD COLUMN signature_employe TEXT;
