
ALTER TABLE public.employes ADD COLUMN prix_heure numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employes.prix_heure IS 'Prix par heure de cours pour les enseignants du secondaire';
