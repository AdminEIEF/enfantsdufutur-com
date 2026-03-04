
-- Add option_robotique to eleves table
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS option_robotique boolean DEFAULT false;

-- Create robotics_attendance table
CREATE TABLE public.robotics_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  date_seance date NOT NULL DEFAULT CURRENT_DATE,
  statut text NOT NULL DEFAULT 'absent',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (eleve_id, date_seance)
);

-- Enable RLS
ALTER TABLE public.robotics_attendance ENABLE ROW LEVEL SECURITY;

-- Robotique role can manage attendance
CREATE POLICY "Robotique can manage attendance"
ON public.robotics_attendance FOR ALL
USING (public.has_role(auth.uid(), 'robotique'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'robotique'::app_role));

-- Admin/Secretaire can manage attendance
CREATE POLICY "Admin_Secretaire can manage attendance"
ON public.robotics_attendance FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'secretaire'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'secretaire'::app_role));

-- Enable realtime for eleves (for robotique flag updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.robotics_attendance;
