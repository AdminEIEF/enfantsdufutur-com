
-- Add visibility toggle to cours table
ALTER TABLE public.cours ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;
