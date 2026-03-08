
CREATE OR REPLACE FUNCTION public.find_famille_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _famille RECORD;
BEGIN
  FOR _famille IN SELECT id, code_acces FROM public.familles WHERE code_acces IS NOT NULL
  LOOP
    IF _famille.code_acces = extensions.crypt(_code, _famille.code_acces) THEN
      RETURN _famille.id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
