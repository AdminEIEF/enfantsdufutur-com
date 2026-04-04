
ALTER TABLE public.articles ADD COLUMN fichier_url TEXT;
ALTER TABLE public.articles ADD COLUMN fichier_nom TEXT;

INSERT INTO storage.buckets (id, name, public) VALUES ('livres-numeriques', 'livres-numeriques', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin can manage digital books" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'livres-numeriques' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'superviseur')
))
WITH CHECK (bucket_id = 'livres-numeriques' AND (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'superviseur')
));
