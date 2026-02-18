
-- Add access code column to familles for parent portal authentication
ALTER TABLE public.familles ADD COLUMN code_acces text UNIQUE;

-- Create index for fast lookup
CREATE INDEX idx_familles_code_acces ON public.familles(code_acces) WHERE code_acces IS NOT NULL;
