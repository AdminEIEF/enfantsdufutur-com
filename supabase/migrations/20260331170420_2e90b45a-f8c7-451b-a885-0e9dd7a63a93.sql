
-- Table des compositions (examens en ligne)
CREATE TABLE public.compositions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT,
  classe_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id UUID NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  duree_minutes INTEGER NOT NULL DEFAULT 30,
  date_debut TIMESTAMP WITH TIME ZONE NOT NULL,
  date_fin TIMESTAMP WITH TIME ZONE NOT NULL,
  bareme NUMERIC NOT NULL DEFAULT 20,
  publie BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des questions de composition
CREATE TABLE public.composition_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  composition_id UUID NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  type_question TEXT NOT NULL DEFAULT 'qcm' CHECK (type_question IN ('qcm', 'vrai_faux')),
  enonce TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  reponse_correcte TEXT NOT NULL,
  points NUMERIC NOT NULL DEFAULT 1,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des réponses des élèves
CREATE TABLE public.composition_reponses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  composition_id UUID NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  reponses JSONB NOT NULL DEFAULT '{}',
  score NUMERIC,
  soumis_at TIMESTAMP WITH TIME ZONE,
  debut_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(composition_id, eleve_id)
);

-- Enable RLS
ALTER TABLE public.compositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composition_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composition_reponses ENABLE ROW LEVEL SECURITY;

-- RLS: compositions - staff can manage
CREATE POLICY "Staff can view compositions" ON public.compositions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Superviseur can insert compositions" ON public.compositions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superviseur') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Superviseur can update compositions" ON public.compositions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'superviseur') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Superviseur can delete compositions" ON public.compositions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'superviseur') OR public.has_role(auth.uid(), 'admin'));

-- RLS: composition_questions
CREATE POLICY "Staff can view questions" ON public.composition_questions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Staff can manage questions" ON public.composition_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- RLS: composition_reponses
CREATE POLICY "Staff can view reponses" ON public.composition_reponses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Staff can manage reponses" ON public.composition_reponses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Triggers for updated_at
CREATE TRIGGER update_compositions_updated_at BEFORE UPDATE ON public.compositions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
