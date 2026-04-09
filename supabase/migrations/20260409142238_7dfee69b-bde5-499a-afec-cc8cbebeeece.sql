-- Allow superviseur to insert paiements (for cash transport payments)
CREATE POLICY "Superviseur can insert paiements"
ON public.paiements
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Also allow secretaire to insert paiements
CREATE POLICY "Secretaire can insert paiements"
ON public.paiements
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'secretaire'::app_role)
);
