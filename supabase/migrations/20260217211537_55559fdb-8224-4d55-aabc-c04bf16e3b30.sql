
-- ============================================
-- RLS: repas_cantine - add cantine role
-- ============================================
DROP POLICY IF EXISTS "Admin/Comptable can manage repas" ON public.repas_cantine;
CREATE POLICY "Admin/Comptable/Cantine can manage repas"
  ON public.repas_cantine FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'cantine'::app_role));

DROP POLICY IF EXISTS "Staff can read repas" ON public.repas_cantine;
CREATE POLICY "Staff can read repas"
  ON public.repas_cantine FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'cantine'::app_role));

-- ============================================
-- RLS: eleves - add cantine/boutique/librairie read
-- ============================================
DROP POLICY IF EXISTS "Staff can read eleves" ON public.eleves;
CREATE POLICY "Staff can read eleves"
  ON public.eleves FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'service_info'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'cantine'::app_role) OR has_role(auth.uid(), 'boutique'::app_role) OR has_role(auth.uid(), 'librairie'::app_role));

-- Cantine can update eleves (for solde_cantine debit)
CREATE POLICY "Cantine can update eleves"
  ON public.eleves FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'cantine'::app_role));

-- ============================================
-- RLS: paiements - add cantine role
-- ============================================
DROP POLICY IF EXISTS "Staff can read paiements" ON public.paiements;
CREATE POLICY "Staff can read paiements"
  ON public.paiements FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'cantine'::app_role));

DROP POLICY IF EXISTS "Admin/Comptable can manage paiements" ON public.paiements;
CREATE POLICY "Admin/Comptable/Cantine can manage paiements"
  ON public.paiements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'cantine'::app_role));

-- ============================================
-- RLS: articles - add librairie role
-- ============================================
DROP POLICY IF EXISTS "Admins can manage articles" ON public.articles;
CREATE POLICY "Admin/Librairie can manage articles"
  ON public.articles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'librairie'::app_role));

-- ============================================
-- RLS: ventes_articles - add librairie role
-- ============================================
DROP POLICY IF EXISTS "Admin/Comptable can manage ventes_articles" ON public.ventes_articles;
CREATE POLICY "Admin/Comptable/Librairie can manage ventes_articles"
  ON public.ventes_articles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'librairie'::app_role));

DROP POLICY IF EXISTS "Staff can read ventes_articles" ON public.ventes_articles;
CREATE POLICY "Staff can read ventes_articles"
  ON public.ventes_articles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'librairie'::app_role));

-- ============================================
-- Traceability columns
-- ============================================
ALTER TABLE public.repas_cantine ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.ventes_articles ADD COLUMN IF NOT EXISTS created_by uuid;
