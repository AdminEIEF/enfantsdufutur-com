
-- Table des pré-inscriptions
CREATE TABLE public.pre_inscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Infos élève
  prenom_eleve text NOT NULL,
  nom_eleve text NOT NULL,
  date_naissance date,
  sexe text,
  -- Infos parent
  nom_parent text NOT NULL,
  telephone_parent text NOT NULL,
  email_parent text,
  -- Niveau souhaité
  niveau_id uuid REFERENCES public.niveaux(id),
  -- Options
  option_cantine boolean DEFAULT false,
  option_transport boolean DEFAULT false,
  option_uniformes boolean DEFAULT false,
  -- Workflow
  statut text NOT NULL DEFAULT 'en_attente',
  notes_admin text,
  date_rdv timestamp with time zone,
  traite_par uuid,
  traite_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pre_inscriptions ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (submit form)
CREATE POLICY "Public can submit pre_inscriptions"
ON public.pre_inscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Staff can read
CREATE POLICY "Staff can read pre_inscriptions"
ON public.pre_inscriptions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'secretaire'::app_role)
);

-- Admin/Secretaire can update
CREATE POLICY "Admin/Secretaire can update pre_inscriptions"
ON public.pre_inscriptions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'secretaire'::app_role)
);

-- Admin can delete
CREATE POLICY "Admin can delete pre_inscriptions"
ON public.pre_inscriptions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_pre_inscriptions_updated_at
BEFORE UPDATE ON public.pre_inscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Notify admin on new pre-inscription
CREATE OR REPLACE FUNCTION public.notify_new_pre_inscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (titre, message, destinataire_type, type)
  VALUES (
    '📝 Nouvelle pré-inscription',
    'Demande de pré-inscription pour ' || NEW.prenom_eleve || ' ' || NEW.nom_eleve || ' (Parent: ' || NEW.nom_parent || ', Tél: ' || NEW.telephone_parent || ').',
    'admin',
    'action'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_pre_inscription
AFTER INSERT ON public.pre_inscriptions
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_pre_inscription();
