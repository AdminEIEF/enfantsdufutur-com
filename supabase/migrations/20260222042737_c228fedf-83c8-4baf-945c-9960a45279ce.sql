
-- 1. Make all sensitive buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('photos', 'devoirs', 'cours', 'justificatifs', 'preuves-paiement');

-- 2. Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3. Hash all existing plaintext student passwords
UPDATE public.eleves
SET mot_de_passe_eleve = extensions.crypt(mot_de_passe_eleve, extensions.gen_salt('bf'))
WHERE mot_de_passe_eleve IS NOT NULL
  AND mot_de_passe_eleve NOT LIKE '$2a$%'
  AND mot_de_passe_eleve NOT LIKE '$2b$%';

-- 4. Hash all existing plaintext family access codes
UPDATE public.familles
SET code_acces = extensions.crypt(code_acces, extensions.gen_salt('bf'))
WHERE code_acces IS NOT NULL
  AND code_acces NOT LIKE '$2a$%'
  AND code_acces NOT LIKE '$2b$%';

-- 5. Create trigger to auto-hash student passwords on insert/update
CREATE OR REPLACE FUNCTION public.hash_eleve_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mot_de_passe_eleve IS NOT NULL
    AND NEW.mot_de_passe_eleve NOT LIKE '$2a$%'
    AND NEW.mot_de_passe_eleve NOT LIKE '$2b$%' THEN
    NEW.mot_de_passe_eleve := extensions.crypt(NEW.mot_de_passe_eleve, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_eleve_password
BEFORE INSERT OR UPDATE OF mot_de_passe_eleve ON public.eleves
FOR EACH ROW
EXECUTE FUNCTION public.hash_eleve_password();

-- 6. Create trigger to auto-hash family access codes on insert/update
CREATE OR REPLACE FUNCTION public.hash_famille_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.code_acces IS NOT NULL
    AND NEW.code_acces NOT LIKE '$2a$%'
    AND NEW.code_acces NOT LIKE '$2b$%' THEN
    NEW.code_acces := extensions.crypt(NEW.code_acces, extensions.gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_hash_famille_code
BEFORE INSERT OR UPDATE OF code_acces ON public.familles
FOR EACH ROW
EXECUTE FUNCTION public.hash_famille_code();

-- 7. Add RLS policies for authenticated access to private buckets
-- Photos: authenticated staff can read
CREATE POLICY "Authenticated can read photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos' AND auth.role() = 'authenticated');

-- Devoirs: authenticated can read
CREATE POLICY "Authenticated can read devoirs"
ON storage.objects FOR SELECT
USING (bucket_id = 'devoirs' AND auth.role() = 'authenticated');

-- Cours: authenticated can read
CREATE POLICY "Authenticated can read cours"
ON storage.objects FOR SELECT
USING (bucket_id = 'cours' AND auth.role() = 'authenticated');

-- Justificatifs: authenticated can read
CREATE POLICY "Authenticated can read justificatifs"
ON storage.objects FOR SELECT
USING (bucket_id = 'justificatifs' AND auth.role() = 'authenticated');

-- Preuves-paiement: authenticated can read
CREATE POLICY "Authenticated can read preuves-paiement"
ON storage.objects FOR SELECT
USING (bucket_id = 'preuves-paiement' AND auth.role() = 'authenticated');
