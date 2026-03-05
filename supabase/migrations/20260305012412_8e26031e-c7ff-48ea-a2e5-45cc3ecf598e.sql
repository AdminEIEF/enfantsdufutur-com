
-- Use a trigger to enforce one recharge per student per calendar month
CREATE OR REPLACE FUNCTION public.check_one_recharge_per_month()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.recharges_transport
    WHERE eleve_id = NEW.eleve_id
      AND extract(year FROM date_recharge) = extract(year FROM NEW.date_recharge)
      AND extract(month FROM date_recharge) = extract(month FROM NEW.date_recharge)
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Cet élève a déjà été rechargé pour ce mois';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_one_recharge_per_month
BEFORE INSERT ON public.recharges_transport
FOR EACH ROW EXECUTE FUNCTION public.check_one_recharge_per_month();
