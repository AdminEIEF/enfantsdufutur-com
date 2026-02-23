
-- Table emploi du temps
CREATE TABLE public.emploi_du_temps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classe_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  enseignant_id UUID REFERENCES public.employes(id) ON DELETE SET NULL,
  jour_semaine INTEGER NOT NULL CHECK (jour_semaine BETWEEN 1 AND 7),
  heure_debut TIME NOT NULL,
  heure_fin TIME NOT NULL,
  salle TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(classe_id, jour_semaine, heure_debut)
);

-- Enable RLS
ALTER TABLE public.emploi_du_temps ENABLE ROW LEVEL SECURITY;

-- Admin/ServiceInfo can manage
CREATE POLICY "Admin/ServiceInfo can manage emploi_du_temps"
ON public.emploi_du_temps FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

-- All authenticated can read (students, parents, employees need to see schedules)
CREATE POLICY "Authenticated can read emploi_du_temps"
ON public.emploi_du_temps FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_emploi_du_temps_updated_at
BEFORE UPDATE ON public.emploi_du_temps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.emploi_du_temps IS 'Emploi du temps par classe: créneaux horaires avec matière et enseignant';
