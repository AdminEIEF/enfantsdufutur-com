
-- Table de notifications pour les élèves
CREATE TABLE public.student_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  titre text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  action_url text,
  lu boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.student_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage student_notifications" ON public.student_notifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can manage student_notifications" ON public.student_notifications
  FOR ALL USING (has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Staff can read student_notifications" ON public.student_notifications
  FOR SELECT USING (has_role(auth.uid(), 'comptable'::app_role));

-- Ajouter action_url à parent_notifications
ALTER TABLE public.parent_notifications ADD COLUMN IF NOT EXISTS action_url text;

-- Activer le realtime sur les deux tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_notifications;
