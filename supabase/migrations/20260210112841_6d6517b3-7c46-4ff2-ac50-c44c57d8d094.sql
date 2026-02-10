
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'secretaire', 'service_info', 'comptable');

-- 2. User roles table (separate from profiles as required)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT NOT NULL DEFAULT '',
  email TEXT,
  telephone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer helper: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Helper: get user roles (for frontend)
CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS app_role[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), '{}')
  FROM public.user_roles
  WHERE user_id = auth.uid()
$$;

-- 6. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 9. RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 10. Cycles table
CREATE TABLE public.cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL UNIQUE,
  ordre INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cycles" ON public.cycles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cycles" ON public.cycles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed cycles
INSERT INTO public.cycles (nom, ordre) VALUES
  ('Crèche', 1), ('Maternelle', 2), ('Primaire', 3), ('Collège', 4), ('Lycée', 5);

-- 11. Niveaux table
CREATE TABLE public.niveaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  ordre INT NOT NULL DEFAULT 0,
  frais_scolarite NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.niveaux ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read niveaux" ON public.niveaux
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage niveaux" ON public.niveaux
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 12. Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niveau_id UUID NOT NULL REFERENCES public.niveaux(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  capacite INT DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read classes" ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage classes" ON public.classes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaires can manage classes" ON public.classes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'secretaire'));

-- 13. Familles table
CREATE TABLE public.familles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_famille TEXT NOT NULL,
  adresse TEXT,
  telephone_pere TEXT,
  telephone_mere TEXT,
  email_parent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.familles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_familles_updated_at
  BEFORE UPDATE ON public.familles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff can read familles" ON public.familles
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaire') OR
    public.has_role(auth.uid(), 'comptable') OR
    public.has_role(auth.uid(), 'service_info')
  );
CREATE POLICY "Admin/Secretaire can manage familles" ON public.familles
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire')
  );

-- 14. Eleves table
CREATE TABLE public.eleves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  famille_id UUID REFERENCES public.familles(id) ON DELETE SET NULL,
  matricule TEXT UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE,
  sexe TEXT CHECK (sexe IN ('M', 'F')),
  photo_url TEXT,
  classe_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'inscrit' CHECK (statut IN ('inscrit', 'a_reinscrire', 'ancien', 'rattrapage')),
  transport_zone TEXT,
  option_fournitures BOOLEAN DEFAULT false,
  option_cantine BOOLEAN DEFAULT false,
  uniforme_scolaire BOOLEAN DEFAULT false,
  uniforme_sport BOOLEAN DEFAULT false,
  uniforme_polo_lacoste BOOLEAN DEFAULT false,
  uniforme_karate BOOLEAN DEFAULT false,
  checklist_livret BOOLEAN DEFAULT false,
  checklist_rames BOOLEAN DEFAULT false,
  checklist_marqueurs BOOLEAN DEFAULT false,
  qr_code TEXT UNIQUE,
  solde_cantine NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eleves ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_eleves_updated_at
  BEFORE UPDATE ON public.eleves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff can read eleves" ON public.eleves
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaire') OR
    public.has_role(auth.uid(), 'service_info') OR
    public.has_role(auth.uid(), 'comptable')
  );
CREATE POLICY "Admin/Secretaire can manage eleves" ON public.eleves
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'secretaire')
  );

-- 15. Matieres table
CREATE TABLE public.matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  cycle_id UUID REFERENCES public.cycles(id) ON DELETE CASCADE,
  coefficient NUMERIC(3,1) NOT NULL DEFAULT 1,
  pole TEXT CHECK (pole IN ('scientifique', 'litteraire', 'social', 'autre')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matieres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read matieres" ON public.matieres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage matieres" ON public.matieres
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 16. Periodes table
CREATE TABLE public.periodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  ordre INT NOT NULL,
  annee_scolaire TEXT NOT NULL DEFAULT '2025-2026',
  est_rattrapage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.periodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read periodes" ON public.periodes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage periodes" ON public.periodes
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.periodes (nom, ordre) VALUES
  ('Octobre', 1), ('Décembre', 2), ('Mars', 3), ('Mai', 4), ('Juin', 5);

-- 17. Notes table
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  matiere_id UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  periode_id UUID NOT NULL REFERENCES public.periodes(id) ON DELETE CASCADE,
  note NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(eleve_id, matiere_id, periode_id)
);
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Staff can read notes" ON public.notes
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'service_info') OR
    public.has_role(auth.uid(), 'secretaire') OR
    public.has_role(auth.uid(), 'comptable')
  );
CREATE POLICY "Admin/ServiceInfo can manage notes" ON public.notes
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'service_info')
  );

-- 18. Paiements table
CREATE TABLE public.paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  montant NUMERIC(10,2) NOT NULL,
  type_paiement TEXT NOT NULL CHECK (type_paiement IN ('scolarite', 'transport', 'cantine', 'boutique', 'fournitures', 'uniforme')),
  canal TEXT NOT NULL DEFAULT 'especes' CHECK (canal IN ('especes', 'orange_money', 'mtn_momo')),
  reference TEXT,
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read paiements" ON public.paiements
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'comptable') OR
    public.has_role(auth.uid(), 'secretaire')
  );
CREATE POLICY "Admin/Comptable can manage paiements" ON public.paiements
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comptable')
  );

-- 19. Depenses table
CREATE TABLE public.depenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL CHECK (service IN ('scolarite', 'transport', 'boutique', 'cantine', 'general')),
  libelle TEXT NOT NULL,
  montant NUMERIC(10,2) NOT NULL,
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read depenses" ON public.depenses
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'comptable') OR
    public.has_role(auth.uid(), 'secretaire')
  );
CREATE POLICY "Admin/Comptable can manage depenses" ON public.depenses
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comptable')
  );

-- 20. Tarifs table (configurable by admin)
CREATE TABLE public.tarifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie TEXT NOT NULL CHECK (categorie IN ('transport', 'uniforme_scolaire', 'uniforme_sport', 'uniforme_polo_lacoste', 'uniforme_karate', 'fournitures', 'cantine_mensuel', 'cantine_repas')),
  label TEXT NOT NULL,
  montant NUMERIC(10,2) NOT NULL DEFAULT 0,
  zone_transport TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tarifs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tarifs_updated_at
  BEFORE UPDATE ON public.tarifs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can read tarifs" ON public.tarifs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tarifs" ON public.tarifs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed default tarifs
INSERT INTO public.tarifs (categorie, label, montant, zone_transport) VALUES
  ('transport', 'Zone 1', 25000, 'zone_1'),
  ('transport', 'Zone 2', 35000, 'zone_2'),
  ('transport', 'Zone 3', 50000, 'zone_3'),
  ('uniforme_scolaire', 'Tenue scolaire', 15000, NULL),
  ('uniforme_sport', 'Tenue de sport', 12000, NULL),
  ('uniforme_polo_lacoste', 'Polo Lacoste', 8000, NULL),
  ('uniforme_karate', 'Tenue Karaté', 10000, NULL),
  ('fournitures', 'Kit fournitures', 20000, NULL),
  ('cantine_repas', 'Repas unitaire', 1500, NULL),
  ('cantine_mensuel', 'Abonnement mensuel cantine', 25000, NULL);

-- 21. Parametres fratrie reduction
CREATE TABLE public.parametres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cle TEXT NOT NULL UNIQUE,
  valeur JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.parametres ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_parametres_updated_at
  BEFORE UPDATE ON public.parametres
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Authenticated can read parametres" ON public.parametres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage parametres" ON public.parametres
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.parametres (cle, valeur) VALUES
  ('reduction_fratrie', '{"2eme_enfant": 10, "3eme_enfant_et_plus": 20}'),
  ('annee_scolaire', '"2025-2026"'),
  ('seuil_primaire', '6'),
  ('seuil_secondaire', '12');

-- 22. Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_type TEXT NOT NULL CHECK (destinataire_type IN ('parent', 'staff')),
  destinataire_ref UUID,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'relance', 'paiement', 'cantine', 'reinscription')),
  lu BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read notifications" ON public.notifications
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'secretaire') OR
    public.has_role(auth.uid(), 'comptable')
  );
CREATE POLICY "Admin can manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Secretaire/Comptable can create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'secretaire') OR public.has_role(auth.uid(), 'comptable')
  );

-- 23. Repas cantine (historique)
CREATE TABLE public.repas_cantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  montant_debite NUMERIC(10,2) NOT NULL,
  date_repas TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.repas_cantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read repas" ON public.repas_cantine
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'comptable') OR
    public.has_role(auth.uid(), 'secretaire')
  );
CREATE POLICY "Admin/Comptable can manage repas" ON public.repas_cantine
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comptable')
  );
