
-- Table des événements du calendrier scolaire
CREATE TABLE public.evenements_calendrier (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  date_debut DATE NOT NULL,
  date_fin DATE,
  heure_debut TIME,
  heure_fin TIME,
  classe_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  matiere_id UUID REFERENCES public.matieres(id) ON DELETE SET NULL,
  couleur TEXT DEFAULT '#3b82f6',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evenements_calendrier ENABLE ROW LEVEL SECURITY;

-- Admin/ServiceInfo can manage
CREATE POLICY "Admin/ServiceInfo can manage evenements_calendrier"
ON public.evenements_calendrier FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

-- All staff can read
CREATE POLICY "Staff can read evenements_calendrier"
ON public.evenements_calendrier FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_evenements_calendrier_updated_at
BEFORE UPDATE ON public.evenements_calendrier
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.evenements_calendrier IS 'Calendrier scolaire: examens, vacances, événements, conseils de classe';
