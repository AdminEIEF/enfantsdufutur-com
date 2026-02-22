
-- ============================================================
-- MODULE RH : Tables principales
-- ============================================================

-- Catégorie d'employé
CREATE TYPE public.categorie_employe AS ENUM ('enseignant', 'administration', 'service', 'direction');

-- Table principale des employés
CREATE TABLE public.employes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule text UNIQUE NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  sexe text,
  date_naissance date,
  telephone text,
  email text,
  adresse text,
  photo_url text,
  categorie categorie_employe NOT NULL DEFAULT 'service',
  poste text NOT NULL DEFAULT '',
  date_embauche date NOT NULL DEFAULT CURRENT_DATE,
  date_fin_contrat date,
  salaire_base numeric NOT NULL DEFAULT 0,
  mot_de_passe text,
  statut text NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage employes" ON public.employes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can read employes" ON public.employes FOR SELECT
  USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Trigger pour hasher le mot de passe employé
CREATE OR REPLACE FUNCTION public.hash_employe_password()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mot_de_passe IS NOT NULL
    AND NEW.mot_de_passe NOT LIKE '$2a$%'
    AND NEW.mot_de_passe NOT LIKE '$2b$%' THEN
    NEW.mot_de_passe := extensions.crypt(NEW.mot_de_passe, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_employe_password
BEFORE INSERT OR UPDATE ON public.employes
FOR EACH ROW EXECUTE FUNCTION public.hash_employe_password();

-- Trigger updated_at
CREATE TRIGGER update_employes_updated_at
BEFORE UPDATE ON public.employes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Liaison enseignant-classes
-- ============================================================
CREATE TABLE public.enseignant_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id uuid REFERENCES public.matieres(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employe_id, classe_id, matiere_id)
);

ALTER TABLE public.enseignant_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage enseignant_classes" ON public.enseignant_classes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can read enseignant_classes" ON public.enseignant_classes FOR SELECT
  USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'service_info'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- ============================================================
-- Pointages employés
-- ============================================================
CREATE TABLE public.pointages_employes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  date_pointage date NOT NULL DEFAULT CURRENT_DATE,
  heure_arrivee timestamptz,
  heure_depart timestamptz,
  retard boolean DEFAULT false,
  heures_travaillees numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employe_id, date_pointage)
);

ALTER TABLE public.pointages_employes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage pointages" ON public.pointages_employes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can read pointages" ON public.pointages_employes FOR SELECT
  USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));
CREATE POLICY "Staff can insert pointages" ON public.pointages_employes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- ============================================================
-- Congés
-- ============================================================
CREATE TABLE public.conges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  type_conge text NOT NULL DEFAULT 'annuel',
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  motif text,
  statut text NOT NULL DEFAULT 'en_attente',
  traite_par uuid,
  traite_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage conges" ON public.conges FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can read conges" ON public.conges FOR SELECT
  USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- ============================================================
-- Avances sur salaire
-- ============================================================
CREATE TABLE public.avances_salaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  montant numeric NOT NULL,
  motif text,
  statut text NOT NULL DEFAULT 'en_attente',
  mois_remboursement text,
  montant_rembourse numeric NOT NULL DEFAULT 0,
  traite_par uuid,
  traite_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avances_salaire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage avances" ON public.avances_salaire FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Comptable can read avances" ON public.avances_salaire FOR SELECT
  USING (has_role(auth.uid(), 'comptable'::app_role));

CREATE TRIGGER update_avances_updated_at
BEFORE UPDATE ON public.avances_salaire
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Bulletins de paie
-- ============================================================
CREATE TABLE public.bulletins_paie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  mois integer NOT NULL,
  annee integer NOT NULL,
  salaire_brut numeric NOT NULL DEFAULT 0,
  retenues numeric NOT NULL DEFAULT 0,
  avances_deduites numeric NOT NULL DEFAULT 0,
  primes numeric NOT NULL DEFAULT 0,
  salaire_net numeric NOT NULL DEFAULT 0,
  commentaire text,
  genere_par uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employe_id, mois, annee)
);

ALTER TABLE public.bulletins_paie ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage bulletins_paie" ON public.bulletins_paie FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Comptable can manage bulletins_paie" ON public.bulletins_paie FOR ALL
  USING (has_role(auth.uid(), 'comptable'::app_role));

-- ============================================================
-- Notifications employés
-- ============================================================
CREATE TABLE public.employee_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL REFERENCES public.employes(id) ON DELETE CASCADE,
  titre text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  lu boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can manage employee_notifications" ON public.employee_notifications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage employee_notifications" ON public.employee_notifications FOR ALL
  USING (has_role(auth.uid(), 'secretaire'::app_role));
CREATE POLICY "Comptable can read employee_notifications" ON public.employee_notifications FOR SELECT
  USING (has_role(auth.uid(), 'comptable'::app_role));

-- ============================================================
-- Bucket stockage documents employés
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents-employes', 'documents-employes', false);

CREATE POLICY "Admin can manage documents-employes" ON storage.objects FOR ALL
  USING (bucket_id = 'documents-employes' AND (SELECT has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Staff can read documents-employes" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents-employes' AND (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'comptable'::app_role)));

-- ============================================================
-- Trigger: notification auto si enseignant absent
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_teacher_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _emp RECORD;
  _ec RECORD;
BEGIN
  -- Only for congés approuvés
  IF NEW.statut = 'approuve' AND (OLD.statut IS NULL OR OLD.statut != 'approuve') THEN
    SELECT e.* INTO _emp FROM public.employes e WHERE e.id = NEW.employe_id;
    
    IF _emp.categorie = 'enseignant' THEN
      FOR _ec IN SELECT ec.classe_id FROM public.enseignant_classes ec WHERE ec.employe_id = NEW.employe_id
      LOOP
        -- Notify all students of that class
        INSERT INTO public.student_notifications (eleve_id, titre, message, type)
        SELECT e.id, 
          '📢 Absence enseignant',
          _emp.prenom || ' ' || _emp.nom || ' sera absent(e) du ' || NEW.date_debut::text || ' au ' || NEW.date_fin::text || '.',
          'alerte'
        FROM public.eleves e WHERE e.classe_id = _ec.classe_id AND e.statut = 'inscrit';
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_teacher_absence
AFTER INSERT OR UPDATE ON public.conges
FOR EACH ROW EXECUTE FUNCTION public.notify_teacher_absence();
