ALTER TABLE public.classe_matieres ADD COLUMN IF NOT EXISTS ordre integer NOT NULL DEFAULT 0;
-- Initialiser ordre par classe selon l'ordre actuel des matières
WITH ranked AS (
  SELECT cm.classe_id, cm.matiere_id,
         ROW_NUMBER() OVER (PARTITION BY cm.classe_id ORDER BY m.ordre, m.nom) AS rn
  FROM public.classe_matieres cm
  JOIN public.matieres m ON m.id = cm.matiere_id
)
UPDATE public.classe_matieres cm
SET ordre = r.rn
FROM ranked r
WHERE cm.classe_id = r.classe_id AND cm.matiere_id = r.matiere_id;