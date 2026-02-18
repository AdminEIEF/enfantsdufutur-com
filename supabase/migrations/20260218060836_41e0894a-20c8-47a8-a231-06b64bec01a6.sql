
-- Table pour les justificatifs envoyés par les parents
CREATE TABLE public.justificatifs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id UUID NOT NULL REFERENCES public.familles(id),
  eleve_id UUID REFERENCES public.eleves(id),
  type TEXT NOT NULL DEFAULT 'autre',
  description TEXT,
  fichier_url TEXT NOT NULL,
  fichier_nom TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  traite_par UUID,
  traite_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.justificatifs ENABLE ROW LEVEL SECURITY;

-- Admin/Secretaire can manage
CREATE POLICY "Admin/Secretaire can manage justificatifs"
  ON public.justificatifs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

-- Staff can read
CREATE POLICY "Staff can read justificatifs"
  ON public.justificatifs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Create storage bucket for justificatifs
INSERT INTO storage.buckets (id, name, public) VALUES ('justificatifs', 'justificatifs', true);

-- Storage policies for justificatifs bucket
CREATE POLICY "Anyone can upload justificatifs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'justificatifs');

CREATE POLICY "Anyone can read justificatifs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'justificatifs');

-- Table for parent notifications
CREATE TABLE public.parent_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id UUID NOT NULL REFERENCES public.familles(id),
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  lu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Secretaire can manage parent_notifications"
  ON public.parent_notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

CREATE POLICY "Staff can read parent_notifications"
  ON public.parent_notifications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));
