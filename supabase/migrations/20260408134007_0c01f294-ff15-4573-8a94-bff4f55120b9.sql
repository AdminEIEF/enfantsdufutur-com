
DROP POLICY IF EXISTS "Admins can manage zones_transport" ON public.zones_transport;

CREATE POLICY "Staff can manage zones_transport"
ON public.zones_transport
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
);
