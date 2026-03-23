
-- Table for school year sessions
CREATE TABLE public.sessions_scolaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  active boolean NOT NULL DEFAULT false,
  cloturee boolean NOT NULL DEFAULT false,
  cloturee_at timestamptz,
  cloturee_par uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.sessions_scolaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view sessions" ON public.sessions_scolaires
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur') OR public.has_role(auth.uid(), 'secretaire'));

CREATE POLICY "Admin Superviseur can manage sessions" ON public.sessions_scolaires
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Ensure only one session can be active
CREATE UNIQUE INDEX idx_sessions_scolaires_active ON public.sessions_scolaires (active) WHERE active = true;

-- Archive table for payments
CREATE TABLE public.paiements_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions_scolaires(id) NOT NULL,
  paiement_original_id uuid,
  eleve_id uuid,
  eleve_nom text,
  eleve_prenom text,
  classe_nom text,
  type_paiement text,
  montant numeric NOT NULL DEFAULT 0,
  canal text,
  mois_concerne text,
  date_paiement timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paiements_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view archives" ON public.paiements_archive
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur') OR public.has_role(auth.uid(), 'comptable'));

CREATE POLICY "System can insert archives" ON public.paiements_archive
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Promotion log table
CREATE TABLE public.promotions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.sessions_scolaires(id) NOT NULL,
  eleve_id uuid REFERENCES public.eleves(id),
  ancien_classe_id uuid,
  ancien_classe_nom text,
  nouveau_classe_id uuid,
  nouveau_classe_nom text,
  type text NOT NULL DEFAULT 'promotion',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.promotions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view promotions" ON public.promotions_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admin can insert promotions" ON public.promotions_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Add session_id to key tables for future filtering
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions_scolaires(id);
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions_scolaires(id);
