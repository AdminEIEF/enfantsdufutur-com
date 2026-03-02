
-- Quiz questions table (linked to devoirs)
CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devoir_id uuid NOT NULL REFERENCES public.devoirs(id) ON DELETE CASCADE,
  question text NOT NULL,
  type text NOT NULL DEFAULT 'choix_multiple', -- choix_multiple, vrai_faux
  options jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of {label, correct}
  points numeric NOT NULL DEFAULT 1,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Quiz responses table
CREATE TABLE public.quiz_reponses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devoir_id uuid NOT NULL REFERENCES public.devoirs(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  reponses jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of {question_id, answer_index}
  score numeric DEFAULT NULL,
  score_max numeric DEFAULT NULL,
  soumis_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(devoir_id, eleve_id)
);

-- Add quiz type to devoirs
ALTER TABLE public.devoirs ADD COLUMN IF NOT EXISTS type_devoir text NOT NULL DEFAULT 'fichier';
-- type_devoir: 'fichier' or 'quiz'

-- RLS for quiz_questions
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage quiz_questions"
  ON public.quiz_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Authenticated can read quiz_questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (true);

-- RLS for quiz_reponses
ALTER TABLE public.quiz_reponses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage quiz_reponses"
  ON public.quiz_reponses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Staff can read quiz_reponses"
  ON public.quiz_reponses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));
