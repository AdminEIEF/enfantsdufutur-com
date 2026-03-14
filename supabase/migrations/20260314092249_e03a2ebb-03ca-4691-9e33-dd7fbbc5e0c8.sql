CREATE POLICY "Tresorier can manage avances_salaire"
  ON public.avances_salaire
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'tresorier'::app_role))
  WITH CHECK (has_role(auth.uid(), 'tresorier'::app_role));