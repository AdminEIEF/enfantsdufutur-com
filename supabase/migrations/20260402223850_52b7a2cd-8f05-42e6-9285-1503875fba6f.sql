
CREATE TABLE public.security_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type TEXT NOT NULL DEFAULT 'anonymous',
  user_identifier TEXT,
  attempted_route TEXT NOT NULL,
  ip_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and superviseurs can view security logs"
ON public.security_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur')
);

CREATE POLICY "Anyone can insert security logs"
ON public.security_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
