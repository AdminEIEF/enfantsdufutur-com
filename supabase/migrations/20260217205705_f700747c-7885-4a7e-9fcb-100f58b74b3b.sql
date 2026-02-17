
-- Add plat_nom to repas_cantine for meal tracking
ALTER TABLE public.repas_cantine ADD COLUMN IF NOT EXISTS plat_nom text;

-- Create trigger function to auto-credit solde_cantine when a cantine payment is made
CREATE OR REPLACE FUNCTION public.credit_cantine_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.type_paiement = 'cantine' THEN
    UPDATE public.eleves
    SET solde_cantine = COALESCE(solde_cantine, 0) + NEW.montant,
        updated_at = now()
    WHERE id = NEW.eleve_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Create trigger on paiements table
DROP TRIGGER IF EXISTS trigger_credit_cantine_on_payment ON public.paiements;
CREATE TRIGGER trigger_credit_cantine_on_payment
  AFTER INSERT ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_cantine_on_payment();
