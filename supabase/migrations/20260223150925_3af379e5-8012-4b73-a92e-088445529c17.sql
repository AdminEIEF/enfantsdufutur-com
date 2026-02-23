
-- 1. EMPLOYES: Remove broad "Staff can read" and restrict to admin + secretaire + comptable only
DROP POLICY IF EXISTS "Staff can read employes" ON public.employes;
CREATE POLICY "Admin/Secretaire/Comptable can read employes"
  ON public.employes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'secretaire'::app_role) 
    OR has_role(auth.uid(), 'comptable'::app_role)
  );

-- 2. FAMILLES: Remove service_info from read access
DROP POLICY IF EXISTS "Staff can read familles" ON public.familles;
CREATE POLICY "Admin/Secretaire/Comptable can read familles"
  ON public.familles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'secretaire'::app_role) 
    OR has_role(auth.uid(), 'comptable'::app_role)
  );

-- 3. ELEVES: Replace broad staff read with role-specific policies
DROP POLICY IF EXISTS "Staff can read eleves" ON public.eleves;

-- Admin/Secretaire/ServiceInfo/Comptable: full access to read all columns
CREATE POLICY "Core staff can read eleves"
  ON public.eleves FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'secretaire'::app_role) 
    OR has_role(auth.uid(), 'service_info'::app_role) 
    OR has_role(auth.uid(), 'comptable'::app_role)
  );

-- Cantine/Boutique/Librairie: can still read but only via this restricted policy
-- (Supabase RLS can't filter columns, but we limit which roles get access)
CREATE POLICY "Service staff can read eleves"
  ON public.eleves FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cantine'::app_role) 
    OR has_role(auth.uid(), 'boutique'::app_role) 
    OR has_role(auth.uid(), 'librairie'::app_role)
  );

-- 4. PAIEMENTS: Remove cantine from ALL policy, keep only for SELECT with filtering
DROP POLICY IF EXISTS "Admin/Comptable/Cantine can manage paiements" ON public.paiements;
CREATE POLICY "Admin/Comptable can manage paiements"
  ON public.paiements FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'comptable'::app_role)
  );

-- Cantine can only INSERT cantine payments
CREATE POLICY "Cantine can insert cantine paiements"
  ON public.paiements FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'cantine'::app_role) 
    AND type_paiement = 'cantine'
  );

-- Update the SELECT policy: cantine can only read cantine payments
DROP POLICY IF EXISTS "Staff can read paiements" ON public.paiements;
CREATE POLICY "Staff can read paiements"
  ON public.paiements FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'comptable'::app_role) 
    OR has_role(auth.uid(), 'secretaire'::app_role) 
    OR (has_role(auth.uid(), 'cantine'::app_role) AND type_paiement = 'cantine')
  );
