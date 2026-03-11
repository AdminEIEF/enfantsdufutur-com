-- Allow anonymous users to count eleves (public landing page stats)
CREATE POLICY "Anon can count eleves" ON public.eleves
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous users to count enseignants (public landing page stats)
CREATE POLICY "Anon can count employes" ON public.employes
  FOR SELECT TO anon
  USING (true);