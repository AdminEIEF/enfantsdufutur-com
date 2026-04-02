
ALTER TABLE public.compositions 
  ADD COLUMN IF NOT EXISTS type_composition text NOT NULL DEFAULT 'qcm',
  ADD COLUMN IF NOT EXISTS sujet_url text,
  ADD COLUMN IF NOT EXISTS sujet_nom text;

ALTER TABLE public.composition_reponses 
  ADD COLUMN IF NOT EXISTS reponse_texte text;

COMMENT ON COLUMN public.compositions.type_composition IS 'qcm ou document';
