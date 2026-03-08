
CREATE TABLE public.pointages_eleves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  date_pointage date NOT NULL DEFAULT CURRENT_DATE,
  heure_arrivee timestamp with time zone,
  heure_depart timestamp with time zone,
  scanne_par uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(eleve_id, date_pointage)
);

ALTER TABLE public.pointages_eleves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Secretaire can manage pointages_eleves"
  ON public.pointages_eleves FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaire'));

CREATE POLICY "Staff can read pointages_eleves"
  ON public.pointages_eleves FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'secretaire') OR has_role(auth.uid(), 'service_info'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.pointages_eleves;
