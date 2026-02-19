
-- 1. Add solde_famille (wallet) column to familles
ALTER TABLE public.familles ADD COLUMN IF NOT EXISTS solde_famille numeric NOT NULL DEFAULT 0;

-- 2. Add seuil_alerte_stock to articles and boutique_articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS seuil_alerte_stock integer NOT NULL DEFAULT 10;
ALTER TABLE public.boutique_articles ADD COLUMN IF NOT EXISTS seuil_alerte_stock integer NOT NULL DEFAULT 10;

-- 3. Function to credit famille wallet on payment type 'wallet'
CREATE OR REPLACE FUNCTION public.credit_famille_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type_paiement = 'wallet' THEN
    UPDATE public.familles
    SET solde_famille = COALESCE(solde_famille, 0) + NEW.montant,
        updated_at = now()
    WHERE id = (SELECT famille_id FROM public.eleves WHERE id = NEW.eleve_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger for wallet credit
DROP TRIGGER IF EXISTS trigger_credit_famille_wallet ON public.paiements;
CREATE TRIGGER trigger_credit_famille_wallet
  AFTER INSERT ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_famille_wallet();

-- 5. Function to check stock alerts and create notifications
CREATE OR REPLACE FUNCTION public.check_stock_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seuil integer;
  _nom text;
  _source text;
BEGIN
  IF TG_TABLE_NAME = 'articles' THEN
    _seuil := NEW.seuil_alerte_stock;
    _nom := NEW.nom;
    _source := 'Librairie';
  ELSIF TG_TABLE_NAME = 'boutique_articles' THEN
    _seuil := NEW.seuil_alerte_stock;
    _nom := NEW.nom;
    _source := 'Boutique';
  END IF;

  IF NEW.stock <= _seuil AND (OLD.stock IS NULL OR OLD.stock > _seuil) THEN
    INSERT INTO public.notifications (titre, message, destinataire_type, type)
    VALUES (
      '⚠️ Stock critique — ' || _source,
      'L''article "' || _nom || '" est passé sous le seuil critique (' || NEW.stock || '/' || _seuil || ' restants).',
      'admin',
      'alerte'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Triggers for stock alerts
DROP TRIGGER IF EXISTS trigger_stock_alert_articles ON public.articles;
CREATE TRIGGER trigger_stock_alert_articles
  AFTER UPDATE OF stock ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_alert();

DROP TRIGGER IF EXISTS trigger_stock_alert_boutique ON public.boutique_articles;
CREATE TRIGGER trigger_stock_alert_boutique
  AFTER UPDATE OF stock ON public.boutique_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stock_alert();

-- 7. Function to debit famille wallet (for parent online purchases)
CREATE OR REPLACE FUNCTION public.debit_famille_wallet(
  _famille_id uuid,
  _montant numeric,
  _eleve_id uuid,
  _type_paiement text,
  _description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _solde numeric;
  _paiement_id uuid;
BEGIN
  -- Check balance
  SELECT solde_famille INTO _solde FROM public.familles WHERE id = _famille_id FOR UPDATE;
  
  IF _solde IS NULL OR _solde < _montant THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant. Solde actuel: ' || COALESCE(_solde, 0) || ' GNF');
  END IF;

  -- Debit wallet
  UPDATE public.familles 
  SET solde_famille = solde_famille - _montant, updated_at = now() 
  WHERE id = _famille_id;

  -- Create payment record
  INSERT INTO public.paiements (eleve_id, type_paiement, montant, canal, mois_concerne)
  VALUES (_eleve_id, _type_paiement, _montant, 'portefeuille', _description)
  RETURNING id INTO _paiement_id;

  RETURN json_build_object('success', true, 'paiement_id', _paiement_id);
END;
$$;
