
-- Table des véhicules
CREATE TABLE public.vehicules_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_transport_id UUID REFERENCES public.zones_transport(id) ON DELETE SET NULL,
  immatriculation TEXT NOT NULL,
  marque TEXT,
  modele TEXT,
  capacite INTEGER DEFAULT 30,
  annee INTEGER,
  couleur TEXT,
  assurance_expire DATE,
  controle_technique_expire DATE,
  photo_url TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table des incidents transport
CREATE TABLE public.incidents_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.routes_transport(id) ON DELETE SET NULL,
  zone_transport_id UUID REFERENCES public.zones_transport(id) ON DELETE SET NULL,
  vehicule_id UUID REFERENCES public.vehicules_transport(id) ON DELETE SET NULL,
  type_incident TEXT NOT NULL DEFAULT 'autre', -- panne, accident, comportement, retard, autre
  gravite TEXT NOT NULL DEFAULT 'moyenne', -- faible, moyenne, grave, critique
  description TEXT NOT NULL,
  date_incident DATE NOT NULL DEFAULT CURRENT_DATE,
  heure_incident TIME,
  lieu TEXT,
  signale_par UUID,
  statut TEXT NOT NULL DEFAULT 'ouvert', -- ouvert, en_cours, resolu
  resolution TEXT,
  resolu_par UUID,
  resolu_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table check-in élèves par arrêt
CREATE TABLE public.checkin_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID REFERENCES public.eleves(id) ON DELETE CASCADE NOT NULL,
  arret_id UUID REFERENCES public.arrets_transport(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes_transport(id) ON DELETE SET NULL,
  date_checkin DATE NOT NULL DEFAULT CURRENT_DATE,
  type_trajet TEXT NOT NULL DEFAULT 'aller', -- aller, retour
  present BOOLEAN NOT NULL DEFAULT true,
  heure_checkin TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.vehicules_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents_transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_transport ENABLE ROW LEVEL SECURITY;

-- vehicules_transport
CREATE POLICY "Admin can manage vehicules" ON public.vehicules_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can read vehicules" ON public.vehicules_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable') OR public.has_role(auth.uid(), 'chauffeur'));

-- incidents_transport
CREATE POLICY "Admin can manage incidents" ON public.incidents_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Chauffeur can insert incidents" ON public.incidents_transport FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'chauffeur'));
CREATE POLICY "Chauffeur can read own incidents" ON public.incidents_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'chauffeur'));
CREATE POLICY "Staff can read incidents" ON public.incidents_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable'));

-- checkin_transport
CREATE POLICY "Admin can manage checkin" ON public.checkin_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Chauffeur can manage checkin" ON public.checkin_transport FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'chauffeur'));
CREATE POLICY "Staff can read checkin" ON public.checkin_transport FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable'));
