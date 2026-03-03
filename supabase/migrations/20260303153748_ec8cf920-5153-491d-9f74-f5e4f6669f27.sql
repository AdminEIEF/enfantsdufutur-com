
-- ============================================
-- Grant superviseur access to supervision tables
-- ============================================

-- 1. profiles: superviseur can read all profiles and manage them
CREATE POLICY "Superviseur can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'superviseur'::app_role));

CREATE POLICY "Superviseur can manage all profiles"
ON public.profiles FOR ALL
USING (has_role(auth.uid(), 'superviseur'::app_role));

-- 2. user_roles: superviseur can read and manage all roles
CREATE POLICY "Superviseur can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'superviseur'::app_role));

-- 3. active_connections: superviseur can read and manage
CREATE POLICY "Superviseur can manage active_connections"
ON public.active_connections FOR ALL
USING (has_role(auth.uid(), 'superviseur'::app_role));

-- 4. audit_log: superviseur can read
CREATE POLICY "Superviseur can read audit_log"
ON public.audit_log FOR SELECT
USING (has_role(auth.uid(), 'superviseur'::app_role));

-- 5. user_sessions: superviseur can read and manage
CREATE POLICY "Superviseur can manage user_sessions"
ON public.user_sessions FOR ALL
USING (has_role(auth.uid(), 'superviseur'::app_role));
