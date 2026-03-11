
ALTER TABLE public.matieres ADD COLUMN IF NOT EXISTS ordre integer NOT NULL DEFAULT 0;

-- Set initial order based on created_at
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(niveau_id, cycle_id) ORDER BY created_at) as rn
  FROM public.matieres
)
UPDATE public.matieres m SET ordre = r.rn FROM ranked r WHERE m.id = r.id;
