
-- Table courriers/lettres employés avec pièces jointes
CREATE TABLE public.courriers_employes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employe_id UUID NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'demande', -- demande, maladie, plainte, autre
  objet TEXT NOT NULL,
  contenu TEXT NOT NULL,
  fichier_url TEXT,
  fichier_nom TEXT,
  statut TEXT NOT NULL DEFAULT 'non_lu', -- non_lu, lu, traite
  reponse TEXT,
  traite_par UUID,
  traite_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.courriers_employes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage courriers_employes"
ON public.courriers_employes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read courriers_employes"
ON public.courriers_employes FOR SELECT
USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Table évaluations employés
CREATE TABLE public.evaluations_employes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employe_id UUID NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  periode TEXT NOT NULL, -- ex: "2025-T1", "2025-S1"
  pedagogie NUMERIC DEFAULT 0,
  ponctualite NUMERIC DEFAULT 0,
  assiduite NUMERIC DEFAULT 0,
  relations NUMERIC DEFAULT 0,
  competences NUMERIC DEFAULT 0,
  initiative NUMERIC DEFAULT 0,
  commentaire TEXT,
  evalue_par UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluations_employes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage evaluations_employes"
ON public.evaluations_employes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read evaluations_employes"
ON public.evaluations_employes FOR SELECT
USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Bucket pour les pièces jointes des courriers
INSERT INTO storage.buckets (id, name, public) VALUES ('courriers-employes', 'courriers-employes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin can manage courrier files"
ON storage.objects FOR ALL
USING (bucket_id = 'courriers-employes' AND (
  (SELECT has_role(auth.uid(), 'admin'::app_role))
  OR (SELECT has_role(auth.uid(), 'secretaire'::app_role))
));

CREATE POLICY "Authenticated can upload courrier files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'courriers-employes');

CREATE POLICY "Authenticated can read courrier files"
ON storage.objects FOR SELECT
USING (bucket_id = 'courriers-employes');
