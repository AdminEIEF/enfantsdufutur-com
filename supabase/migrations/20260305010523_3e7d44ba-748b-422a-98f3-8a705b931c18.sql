
-- Table des recharges transport (chaque recharge = 30 jours de validité)
CREATE TABLE public.recharges_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  montant numeric NOT NULL,
  date_recharge timestamp with time zone NOT NULL DEFAULT now(),
  date_expiration timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  actif boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table des validations transport (scan à l'entrée du bus)
CREATE TABLE public.validations_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  recharge_id uuid REFERENCES public.recharges_transport(id),
  zone_transport_id uuid REFERENCES public.zones_transport(id),
  valide boolean NOT NULL DEFAULT false,
  motif_rejet text,
  validated_at timestamp with time zone NOT NULL DEFAULT now(),
  validated_by uuid
);

-- RLS recharges_transport
ALTER TABLE public.recharges_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Comptable can manage recharges_transport"
ON public.recharges_transport FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

CREATE POLICY "Staff can read recharges_transport"
ON public.recharges_transport FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

-- RLS validations_transport
ALTER TABLE public.validations_transport ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Comptable can manage validations_transport"
ON public.validations_transport FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

CREATE POLICY "Staff can read validations_transport"
ON public.validations_transport FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

-- Allow insert for all authenticated (for bus validation scan)
CREATE POLICY "Authenticated can insert validations_transport"
ON public.validations_transport FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
