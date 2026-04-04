
ALTER TABLE public.zones_transport 
  ADD COLUMN IF NOT EXISTS prix_aller_simple numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prix_retour_simple numeric DEFAULT 0;

ALTER TABLE public.eleves
  ADD COLUMN IF NOT EXISTS type_trajet_transport text DEFAULT 'aller_retour';
