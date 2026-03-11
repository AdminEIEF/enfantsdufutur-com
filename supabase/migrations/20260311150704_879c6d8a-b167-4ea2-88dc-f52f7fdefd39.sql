
CREATE TABLE public.classe_matieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id uuid NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(classe_id, matiere_id)
);

ALTER TABLE public.classe_matieres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage classe_matieres"
  ON public.classe_matieres FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read classe_matieres"
  ON public.classe_matieres FOR SELECT
  TO authenticated
  USING (true);
