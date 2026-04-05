
DROP POLICY IF EXISTS "Admin/Librairie can manage articles" ON public.articles;
CREATE POLICY "Staff can manage articles" ON public.articles
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'librairie'::app_role) OR 
  has_role(auth.uid(), 'superviseur'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'librairie'::app_role) OR 
  has_role(auth.uid(), 'superviseur'::app_role)
);
