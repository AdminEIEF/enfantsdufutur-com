
-- Add superviseur to employes SELECT policy
DROP POLICY IF EXISTS "Admin/Secretaire/Comptable can read employes" ON public.employes;
CREATE POLICY "Admin/Secretaire/Comptable/Superviseur can read employes" ON public.employes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'comptable'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to employes ALL policy
DROP POLICY IF EXISTS "Admin can manage employes" ON public.employes;
CREATE POLICY "Admin/Superviseur can manage employes" ON public.employes
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);
