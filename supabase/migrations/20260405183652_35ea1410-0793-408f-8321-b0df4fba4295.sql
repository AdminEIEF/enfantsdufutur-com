
CREATE TABLE public.achats_livres_numeriques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  livre_numerique_id UUID NOT NULL REFERENCES public.livres_numeriques(id) ON DELETE CASCADE,
  commande_id UUID REFERENCES public.commandes_articles(id) ON DELETE SET NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  valide_at TIMESTAMPTZ,
  valide_par UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achats_livres_numeriques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage achats_livres_numeriques"
  ON public.achats_livres_numeriques FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'superviseur')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'superviseur')
  );
