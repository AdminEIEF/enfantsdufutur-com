-- Create table for treasurer payment records
CREATE TABLE IF NOT EXISTS public.paiements_tresorier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  montant numeric NOT NULL DEFAULT 0,
  mois integer NOT NULL,
  annee integer NOT NULL,
  date_paiement timestamp with time zone NOT NULL DEFAULT now(),
  paye_par uuid,
  statut text NOT NULL DEFAULT 'paye',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(employe_id, mois, annee)
);

ALTER TABLE public.paiements_tresorier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tresorier/Admin can manage paiements_tresorier"
ON public.paiements_tresorier FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tresorier'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can read paiements_tresorier"
ON public.paiements_tresorier FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'superviseur'::app_role));

CREATE POLICY "Tresorier can read employes"
ON public.employes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'tresorier'::app_role));