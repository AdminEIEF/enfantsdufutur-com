
-- Add superviseur to eleves SELECT policy
DROP POLICY IF EXISTS "Core staff can read eleves" ON public.eleves;
CREATE POLICY "Core staff can read eleves" ON public.eleves
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'service_info'::app_role) OR
  has_role(auth.uid(), 'comptable'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to eleves ALL policy
DROP POLICY IF EXISTS "Admin/Secretaire can manage eleves" ON public.eleves;
CREATE POLICY "Admin/Secretaire/Superviseur can manage eleves" ON public.eleves
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to familles policies
DROP POLICY IF EXISTS "Admin staff can manage familles" ON public.familles;
CREATE POLICY "Admin staff can manage familles" ON public.familles
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to classes SELECT
DROP POLICY IF EXISTS "Staff can read classes" ON public.classes;
CREATE POLICY "Staff can read classes" ON public.classes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'service_info'::app_role) OR
  has_role(auth.uid(), 'comptable'::app_role) OR
  has_role(auth.uid(), 'coordinateur'::app_role) OR
  has_role(auth.uid(), 'coordinateur_secondaire'::app_role) OR
  has_role(auth.uid(), 'cantine'::app_role) OR
  has_role(auth.uid(), 'boutique'::app_role) OR
  has_role(auth.uid(), 'librairie'::app_role) OR
  has_role(auth.uid(), 'chauffeur'::app_role) OR
  has_role(auth.uid(), 'pointeur'::app_role) OR
  has_role(auth.uid(), 'surveillant'::app_role) OR
  has_role(auth.uid(), 'tresorier'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to niveaux SELECT
DROP POLICY IF EXISTS "Staff can read niveaux" ON public.niveaux;
CREATE POLICY "Staff can read niveaux" ON public.niveaux
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'service_info'::app_role) OR
  has_role(auth.uid(), 'comptable'::app_role) OR
  has_role(auth.uid(), 'coordinateur'::app_role) OR
  has_role(auth.uid(), 'coordinateur_secondaire'::app_role) OR
  has_role(auth.uid(), 'cantine'::app_role) OR
  has_role(auth.uid(), 'boutique'::app_role) OR
  has_role(auth.uid(), 'librairie'::app_role) OR
  has_role(auth.uid(), 'chauffeur'::app_role) OR
  has_role(auth.uid(), 'pointeur'::app_role) OR
  has_role(auth.uid(), 'surveillant'::app_role) OR
  has_role(auth.uid(), 'tresorier'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to paiements
DROP POLICY IF EXISTS "Staff can read paiements" ON public.paiements;
CREATE POLICY "Staff can read paiements" ON public.paiements
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'comptable'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);

-- Add superviseur to notes
DROP POLICY IF EXISTS "Staff can read notes" ON public.notes;
CREATE POLICY "Staff can read notes" ON public.notes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'secretaire'::app_role) OR
  has_role(auth.uid(), 'service_info'::app_role) OR
  has_role(auth.uid(), 'coordinateur'::app_role) OR
  has_role(auth.uid(), 'coordinateur_secondaire'::app_role) OR
  has_role(auth.uid(), 'superviseur'::app_role)
);
