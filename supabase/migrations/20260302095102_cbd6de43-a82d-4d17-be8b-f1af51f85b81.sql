
-- Add telephone_retrait to coordinateur_documents
ALTER TABLE public.coordinateur_documents ADD COLUMN IF NOT EXISTS telephone_retrait text;

-- Add validation fields to coordinateur_eleves
ALTER TABLE public.coordinateur_eleves ADD COLUMN IF NOT EXISTS valide boolean NOT NULL DEFAULT false;
ALTER TABLE public.coordinateur_eleves ADD COLUMN IF NOT EXISTS valide_at timestamp with time zone;
ALTER TABLE public.coordinateur_eleves ADD COLUMN IF NOT EXISTS pre_inscription_id uuid REFERENCES public.pre_inscriptions(id);

-- Create history table for document movements
CREATE TABLE public.coordinateur_documents_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.coordinateur_documents(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.coordinateur_eleves(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'depot' or 'retrait'
  type_document text NOT NULL,
  note text,
  telephone text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coordinateur_documents_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Secretaire can manage coordinateur_docs_historique"
  ON public.coordinateur_documents_historique FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));
