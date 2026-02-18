
-- Table to track bulletin publication status per classe/period
CREATE TABLE public.bulletin_publications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  periode_id uuid NOT NULL REFERENCES public.periodes(id) ON DELETE CASCADE,
  visible_parent boolean NOT NULL DEFAULT false,
  published_by uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(classe_id, periode_id)
);

ALTER TABLE public.bulletin_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage bulletin_publications"
  ON public.bulletin_publications FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Staff can read bulletin_publications"
  ON public.bulletin_publications FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));
