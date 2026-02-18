
-- Table pour les ordres/intentions de rechargement cantine
CREATE TABLE public.ordres_cantine (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  famille_id uuid NOT NULL REFERENCES public.familles(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  montant numeric NOT NULL,
  code_transaction text NOT NULL DEFAULT 'CAN-' || substr(gen_random_uuid()::text, 1, 8),
  statut text NOT NULL DEFAULT 'en_attente',
  -- en_attente, valide, annule
  validated_by uuid,
  validated_at timestamp with time zone,
  canal text NOT NULL DEFAULT 'ordre_parent',
  -- ordre_parent, direct_caisse
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ordres_cantine ENABLE ROW LEVEL SECURITY;

-- Admin/Comptable can manage
CREATE POLICY "Admin/Comptable can manage ordres_cantine"
  ON public.ordres_cantine FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Staff can read
CREATE POLICY "Staff can read ordres_cantine"
  ON public.ordres_cantine FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'cantine'::app_role));

-- Index for fast lookups
CREATE INDEX idx_ordres_cantine_statut ON public.ordres_cantine(statut);
CREATE INDEX idx_ordres_cantine_famille ON public.ordres_cantine(famille_id);
CREATE INDEX idx_ordres_cantine_code ON public.ordres_cantine(code_transaction);
