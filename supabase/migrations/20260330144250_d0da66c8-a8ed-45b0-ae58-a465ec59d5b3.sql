
CREATE POLICY "Public can read niveaux" ON public.niveaux FOR SELECT TO anon USING (true);
CREATE POLICY "Public can read cycles" ON public.cycles FOR SELECT TO anon USING (true);
