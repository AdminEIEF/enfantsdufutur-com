
-- Create fournisseurs table
CREATE TABLE public.fournisseurs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  categorie TEXT NOT NULL, -- transport, cantine, librairie, boutique, fonctionnement
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read fournisseurs" ON public.fournisseurs
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role)
  OR has_role(auth.uid(), 'cantine'::app_role) OR has_role(auth.uid(), 'librairie'::app_role)
  OR has_role(auth.uid(), 'boutique'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role)
);

CREATE POLICY "Admin/Comptable can manage fournisseurs" ON public.fournisseurs
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role)
);

-- Add columns to depenses table
ALTER TABLE public.depenses
  ADD COLUMN sous_categorie TEXT,
  ADD COLUMN fournisseur_id UUID REFERENCES public.fournisseurs(id),
  ADD COLUMN statut TEXT NOT NULL DEFAULT 'validee',
  ADD COLUMN validated_by UUID,
  ADD COLUMN validated_at TIMESTAMP WITH TIME ZONE;

-- Update RLS on depenses to allow cantine/librairie/boutique to submit
DROP POLICY IF EXISTS "Admin/Comptable can manage depenses" ON public.depenses;

CREATE POLICY "Admin/Comptable can manage depenses" ON public.depenses
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role)
);

CREATE POLICY "Service managers can submit depenses" ON public.depenses
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'cantine'::app_role) OR has_role(auth.uid(), 'librairie'::app_role)
  OR has_role(auth.uid(), 'boutique'::app_role)
);

CREATE POLICY "Service managers can read own depenses" ON public.depenses
FOR SELECT USING (
  has_role(auth.uid(), 'cantine'::app_role) OR has_role(auth.uid(), 'librairie'::app_role)
  OR has_role(auth.uid(), 'boutique'::app_role)
);

-- Update trigger for fournisseurs
CREATE TRIGGER update_fournisseurs_updated_at
BEFORE UPDATE ON public.fournisseurs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
