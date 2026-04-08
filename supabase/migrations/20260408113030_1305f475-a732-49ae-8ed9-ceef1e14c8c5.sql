
CREATE TABLE public.exam_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  composition_id UUID REFERENCES public.compositions(id) ON DELETE SET NULL,
  score_qcm INTEGER DEFAULT 0,
  total_qcm INTEGER DEFAULT 0,
  dessin_url TEXT,
  reponses_detail JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supervisors can manage exam_submissions" ON public.exam_submissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superviseur'))
  WITH CHECK (public.has_role(auth.uid(), 'superviseur'));

CREATE POLICY "Admins can manage exam_submissions" ON public.exam_submissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
