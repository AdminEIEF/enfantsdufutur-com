
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS checklist_photo boolean DEFAULT false;
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS filiation text;
