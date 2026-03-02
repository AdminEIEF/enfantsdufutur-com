-- Allow coordinateur to manage coordinateur_eleves
CREATE POLICY "Coordinateur can manage coordinateur_eleves"
ON public.coordinateur_eleves
FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow coordinateur to manage coordinateur_documents
CREATE POLICY "Coordinateur can manage coordinateur_documents"
ON public.coordinateur_documents
FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow coordinateur to manage coordinateur_documents_historique
CREATE POLICY "Coordinateur can manage coordinateur_documents_historique"
ON public.coordinateur_documents_historique
FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow coordinateur to insert pre_inscriptions
CREATE POLICY "Coordinateur can insert pre_inscriptions"
ON public.pre_inscriptions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'coordinateur'::app_role));

-- Allow coordinateur to read pre_inscriptions
CREATE POLICY "Coordinateur can read pre_inscriptions"
ON public.pre_inscriptions
FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role));