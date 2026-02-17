-- Add bank-specific columns to paiements
ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS banque_nom TEXT,
  ADD COLUMN IF NOT EXISTS date_depot DATE,
  ADD COLUMN IF NOT EXISTS preuve_url TEXT;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('preuves-paiement', 'preuves-paiement', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment proofs
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'preuves-paiement');

CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'preuves-paiement');

CREATE POLICY "Authenticated users can update their proofs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'preuves-paiement');

-- Add default bank list in parametres
INSERT INTO public.parametres (cle, valeur)
VALUES ('banques_partenaires', '["Ecobank", "Société Générale (SGBG)", "Vistabank", "UBA", "Orabank", "FBNBank", "Coris Bank"]'::jsonb)
ON CONFLICT (cle) DO NOTHING;