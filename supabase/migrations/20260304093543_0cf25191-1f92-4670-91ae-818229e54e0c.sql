DO $$
DECLARE
  _prefix text;
  _count integer;
  _seq integer;
  _rec record;
BEGIN
  _prefix := 'EDU-' || right(extract(year from now())::text, 2) || lpad(extract(month from now())::integer::text, 2, '0');
  
  -- Get current max sequence for this prefix
  SELECT COUNT(*) INTO _count FROM public.eleves WHERE matricule LIKE _prefix || '%';
  _seq := _count;
  
  -- Assign matricules to all students without one
  FOR _rec IN 
    SELECT id FROM public.eleves 
    WHERE matricule IS NULL AND statut = 'inscrit' AND deleted_at IS NULL
    ORDER BY created_at ASC
  LOOP
    _seq := _seq + 1;
    UPDATE public.eleves 
    SET matricule = _prefix || '-' || lpad(_seq::text, 4, '0'),
        qr_code = _prefix || '-' || lpad(_seq::text, 4, '0'),
        updated_at = now()
    WHERE id = _rec.id;
  END LOOP;
END $$;