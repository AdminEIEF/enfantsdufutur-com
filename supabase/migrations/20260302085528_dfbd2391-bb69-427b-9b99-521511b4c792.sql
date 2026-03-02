
-- Add blocked fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_by uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz,
  ip_address text,
  user_agent text
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage user_sessions" ON public.user_sessions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text NOT NULL,
  table_name text,
  record_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read audit_log" ON public.audit_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert audit_log" ON public.audit_log
  FOR INSERT WITH CHECK (true);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.log_table_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, details)
    VALUES (auth.uid(), _email, 'DELETE', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, details)
    VALUES (auth.uid(), _email, 'UPDATE', TG_TABLE_NAME, NEW.id::text, jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, details)
    VALUES (auth.uid(), _email, 'INSERT', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

-- Add audit triggers on key tables
CREATE TRIGGER audit_eleves AFTER INSERT OR UPDATE OR DELETE ON public.eleves
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER audit_paiements AFTER INSERT OR UPDATE OR DELETE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER audit_familles AFTER INSERT OR UPDATE OR DELETE ON public.familles
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER audit_notes AFTER INSERT OR UPDATE OR DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER audit_depenses AFTER INSERT OR UPDATE OR DELETE ON public.depenses
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER audit_classes AFTER INSERT OR UPDATE OR DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

CREATE TRIGGER audit_employes AFTER INSERT OR UPDATE OR DELETE ON public.employes
  FOR EACH ROW EXECUTE FUNCTION public.log_table_change();

-- Enable realtime on audit_log and user_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
