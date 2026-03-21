
-- Drop existing SELECT policy and recreate with all staff roles
DROP POLICY IF EXISTS "Staff can read notifications" ON public.notifications;
CREATE POLICY "Staff can read notifications" ON public.notifications
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'comptable'::app_role) OR
  has_role(auth.uid(), 'boutique'::app_role) OR
  has_role(auth.uid(), 'cantine'::app_role) OR
  has_role(auth.uid(), 'librairie'::app_role) OR
  has_role(auth.uid(), 'coordinateur'::app_role) OR
  has_role(auth.uid(), 'coordinateur_secondaire'::app_role) OR
  has_role(auth.uid(), 'tresorier'::app_role) OR
  has_role(auth.uid(), 'service_info'::app_role) OR
  has_role(auth.uid(), 'robotique'::app_role) OR
  has_role(auth.uid(), 'pointeur'::app_role) OR
  has_role(auth.uid(), 'surveillant'::app_role) OR
  has_role(auth.uid(), 'chauffeur'::app_role)
);

-- Also update the Admin can manage policy to include superviseur
DROP POLICY IF EXISTS "Admin can manage notifications" ON public.notifications;
CREATE POLICY "Admin can manage notifications" ON public.notifications
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superviseur'::app_role));
