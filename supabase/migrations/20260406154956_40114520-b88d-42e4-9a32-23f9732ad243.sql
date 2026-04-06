
ALTER TABLE public.eleves 
  ADD COLUMN IF NOT EXISTS print_status text NOT NULL DEFAULT 'en_attente',
  ADD COLUMN IF NOT EXISTS last_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS print_count integer NOT NULL DEFAULT 0;
