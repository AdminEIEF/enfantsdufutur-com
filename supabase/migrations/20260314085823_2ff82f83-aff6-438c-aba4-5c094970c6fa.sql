CREATE POLICY "Tresorier can manage bulletins_paie"
  ON public.bulletins_paie
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'tresorier'::app_role))
  WITH CHECK (has_role(auth.uid(), 'tresorier'::app_role));