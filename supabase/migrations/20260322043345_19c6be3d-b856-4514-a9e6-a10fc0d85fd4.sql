
-- Junction table: multiple classes per event, each with optional matiere
CREATE TABLE public.evenement_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evenement_id uuid NOT NULL REFERENCES public.evenements_calendrier(id) ON DELETE CASCADE,
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id uuid REFERENCES public.matieres(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evenement_id, classe_id)
);

ALTER TABLE public.evenement_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage evenement_classes"
  ON public.evenement_classes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Coordinateur can manage evenement_classes"
  ON public.evenement_classes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'coordinateur'::app_role));

CREATE POLICY "Staff can read evenement_classes"
  ON public.evenement_classes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));
