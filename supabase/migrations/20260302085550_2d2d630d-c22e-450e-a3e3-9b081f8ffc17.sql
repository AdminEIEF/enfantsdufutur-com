
-- Fix the permissive INSERT policy on audit_log - only system triggers insert via SECURITY DEFINER
DROP POLICY IF EXISTS "System can insert audit_log" ON public.audit_log;
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
