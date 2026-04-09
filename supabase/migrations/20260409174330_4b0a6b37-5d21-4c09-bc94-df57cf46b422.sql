-- Fix: the old policy reads from auth.users directly which causes "permission denied for table users"
-- Replace it with auth.email() which is a built-in function that doesn't require table access

DROP POLICY IF EXISTS "Chauffeur can read own employe record" ON public.employes;

CREATE POLICY "Chauffeur can read own employe record"
ON public.employes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND email = auth.email()
);