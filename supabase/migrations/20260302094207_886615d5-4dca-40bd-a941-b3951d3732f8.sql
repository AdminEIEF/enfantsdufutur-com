
-- Table pour les élèves enregistrés par les coordinateurs
CREATE TABLE public.coordinateur_eleves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  ecole_provenance text NOT NULL DEFAULT '',
  niveau_scolaire text NOT NULL DEFAULT '',
  statut text NOT NULL DEFAULT 'actif',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.coordinateur_eleves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Secretaire can manage coordinateur_eleves"
  ON public.coordinateur_eleves FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

CREATE POLICY "Authenticated can read coordinateur_eleves"
  ON public.coordinateur_eleves FOR SELECT
  USING (true);

-- Table pour le suivi des documents
CREATE TABLE public.coordinateur_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.coordinateur_eleves(id) ON DELETE CASCADE,
  type_document text NOT NULL,
  date_depot timestamptz,
  date_retrait timestamptz,
  note_retrait text,
  statut text NOT NULL DEFAULT 'non_depose',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coordinateur_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Secretaire can manage coordinateur_documents"
  ON public.coordinateur_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

CREATE POLICY "Authenticated can read coordinateur_documents"
  ON public.coordinateur_documents FOR SELECT
  USING (true);

-- Trigger updated_at
CREATE TRIGGER update_coordinateur_eleves_updated_at
  BEFORE UPDATE ON public.coordinateur_eleves
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coordinateur_documents_updated_at
  BEFORE UPDATE ON public.coordinateur_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
