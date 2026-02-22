
-- Create verify_password function for bcrypt comparison
CREATE OR REPLACE FUNCTION public.verify_password(_hash text, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN _hash = extensions.crypt(_password, _hash);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;
