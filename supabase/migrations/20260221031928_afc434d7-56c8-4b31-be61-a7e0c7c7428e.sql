
-- Create generic payment orders table (like ordres_cantine but for librairie, boutique, wallet recharge)
CREATE TABLE public.ordres_paiement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id UUID NOT NULL REFERENCES public.familles(id),
  eleve_id UUID REFERENCES public.eleves(id),
  type_service TEXT NOT NULL DEFAULT 'wallet',
  montant NUMERIC NOT NULL,
  description TEXT,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  code_transaction TEXT NOT NULL DEFAULT ('ORD-' || substr((gen_random_uuid())::text, 1, 8)),
  canal TEXT NOT NULL DEFAULT 'ordre_parent',
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordres_paiement ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin/Comptable can manage ordres_paiement"
ON public.ordres_paiement FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

CREATE POLICY "Staff can read ordres_paiement"
ON public.ordres_paiement FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'comptable'::app_role) OR 
  has_role(auth.uid(), 'boutique'::app_role) OR 
  has_role(auth.uid(), 'librairie'::app_role) OR
  has_role(auth.uid(), 'cantine'::app_role)
);
