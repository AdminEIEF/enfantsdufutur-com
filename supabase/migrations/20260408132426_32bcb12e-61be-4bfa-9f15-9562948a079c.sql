
-- Table to store generated student passwords (plain text for supervisor/coordinator visibility)
CREATE TABLE public.generated_student_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  password_plain text NOT NULL,
  generated_by uuid,
  visible_coordinateur_primaire boolean NOT NULL DEFAULT false,
  visible_coordinateur_secondaire boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(eleve_id)
);

ALTER TABLE public.generated_student_codes ENABLE ROW LEVEL SECURITY;

-- Supervisors and admins can do everything
CREATE POLICY "staff_manage_student_codes" ON public.generated_student_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Coordinators can only read when visibility is enabled for them
CREATE POLICY "coordinateur_read_student_codes" ON public.generated_student_codes
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'coordinateur') AND visible_coordinateur_primaire = true)
    OR
    (public.has_role(auth.uid(), 'coordinateur_secondaire') AND visible_coordinateur_secondaire = true)
  );
