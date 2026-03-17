
-- Table des itinéraires/routes de transport
CREATE TABLE public.routes_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_transport_id UUID REFERENCES public.zones_transport(id) ON DELETE CASCADE NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  heure_depart_matin TIME NOT NULL DEFAULT '06:30',
  heure_arrivee_matin TIME NOT NULL DEFAULT '07:30',
  heure_depart_soir TIME NOT NULL DEFAULT '16:00',
  heure_arrivee_soir TIME NOT NULL DEFAULT '17:00',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des arrêts sur chaque route
CREATE TABLE public.arrets_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes_transport(id) ON DELETE CASCADE NOT NULL,
  nom TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  heure_passage_matin TIME,
  heure_passage_soir TIME,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des trajets journaliers (ponctualité)
CREATE TABLE public.trajets_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes_transport(id) ON DELETE CASCADE NOT NULL,
  date_trajet DATE NOT NULL DEFAULT CURRENT_DATE,
  type_trajet TEXT NOT NULL DEFAULT 'aller', -- 'aller' ou 'retour'
  heure_depart_reelle TIMESTAMPTZ,
  heure_arrivee_reelle TIMESTAMPTZ,
  statut TEXT NOT NULL DEFAULT 'en_cours', -- 'en_cours', 'termine', 'annule'
  retard_minutes INTEGER DEFAULT 0,
  motif_retard TEXT,
  signale_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.routes_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrets_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trajets_transport ENABLE ROW LEVEL SECURITY;

-- Policies routes_transport
CREATE POLICY "Admin can manage routes_transport" ON public.routes_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can read routes_transport" ON public.routes_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable') OR public.has_role(auth.uid(), 'chauffeur'));

-- Policies arrets_transport
CREATE POLICY "Admin can manage arrets_transport" ON public.arrets_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can read arrets_transport" ON public.arrets_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable') OR public.has_role(auth.uid(), 'chauffeur'));

-- Policies trajets_transport
CREATE POLICY "Admin can manage trajets_transport" ON public.trajets_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Chauffeur can insert trajets_transport" ON public.trajets_transport FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'chauffeur'));
CREATE POLICY "Chauffeur can update trajets_transport" ON public.trajets_transport FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'chauffeur'));
CREATE POLICY "Staff can read trajets_transport" ON public.trajets_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable') OR public.has_role(auth.uid(), 'chauffeur'));
