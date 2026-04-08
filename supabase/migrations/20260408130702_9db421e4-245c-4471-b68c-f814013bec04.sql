
CREATE TABLE public.generated_family_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  famille_id uuid REFERENCES public.familles(id) ON DELETE CASCADE NOT NULL,
  code_plain text NOT NULL,
  generated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(famille_id)
);

ALTER TABLE public.generated_family_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superviseurs et admins peuvent lire les codes"
  ON public.generated_family_codes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'superviseur') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Superviseurs peuvent insérer/modifier les codes"
  ON public.generated_family_codes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Superviseurs peuvent mettre à jour les codes"
  ON public.generated_family_codes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superviseur'));
