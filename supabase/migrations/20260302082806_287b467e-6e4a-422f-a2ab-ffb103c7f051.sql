
-- Table for student evaluations of their teachers
CREATE TABLE public.eval_enseignants_eleves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.eleves(id),
  enseignant_id uuid NOT NULL REFERENCES public.employes(id),
  periode text NOT NULL,
  pedagogie integer NOT NULL DEFAULT 5 CHECK (pedagogie >= 1 AND pedagogie <= 10),
  ponctualite integer NOT NULL DEFAULT 5 CHECK (ponctualite >= 1 AND ponctualite <= 10),
  competences integer NOT NULL DEFAULT 5 CHECK (competences >= 1 AND competences <= 10),
  relations integer NOT NULL DEFAULT 5 CHECK (relations >= 1 AND relations <= 10),
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(eleve_id, enseignant_id, periode)
);

-- RLS
ALTER TABLE public.eval_enseignants_eleves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage eval_enseignants_eleves"
  ON public.eval_enseignants_eleves FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read eval_enseignants_eleves"
  ON public.eval_enseignants_eleves FOR SELECT
  USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));
