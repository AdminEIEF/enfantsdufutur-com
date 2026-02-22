
-- Trigger: notification automatique lors d'un achat boutique
CREATE OR REPLACE FUNCTION public.notify_parent_boutique_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _famille_id uuid;
  _eleve_nom text;
  _eleve_prenom text;
BEGIN
  SELECT e.famille_id, e.nom, e.prenom 
  INTO _famille_id, _eleve_nom, _eleve_prenom
  FROM public.eleves e WHERE e.id = NEW.eleve_id;

  IF _famille_id IS NOT NULL THEN
    INSERT INTO public.parent_notifications (famille_id, titre, message, type)
    VALUES (
      _famille_id,
      '🛍️ Achat boutique validé',
      'Un achat de ' || NEW.montant_final::text || ' GNF a été effectué pour ' || _eleve_prenom || ' ' || _eleve_nom || '.',
      'info'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_boutique_purchase
AFTER INSERT ON public.boutique_ventes
FOR EACH ROW
EXECUTE FUNCTION public.notify_parent_boutique_purchase();

-- Fonction pour rappel d'échéance crédit à J-2
CREATE OR REPLACE FUNCTION public.notify_credit_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Pour chaque vente à crédit en cours, envoyer un rappel si pas déjà envoyé aujourd'hui
  FOR rec IN
    SELECT vc.id, vc.article_nom, vc.solde_restant, vc.famille_id, 
           e.prenom, e.nom
    FROM public.ventes_credit vc
    JOIN public.eleves e ON e.id = vc.eleve_id
    WHERE vc.statut = 'en_cours' 
      AND vc.famille_id IS NOT NULL
      AND vc.solde_restant > 0
      -- Only if no reminder sent in last 7 days
      AND NOT EXISTS (
        SELECT 1 FROM public.parent_notifications pn 
        WHERE pn.famille_id = vc.famille_id 
          AND pn.type = 'alerte'
          AND pn.titre LIKE '%Rappel échéance crédit%'
          AND pn.created_at > now() - interval '7 days'
      )
  LOOP
    INSERT INTO public.parent_notifications (famille_id, titre, message, type, action_url)
    VALUES (
      rec.famille_id,
      '⏰ Rappel échéance crédit',
      'Crédit "' || rec.article_nom || '" pour ' || rec.prenom || ' ' || rec.nom || ' : il reste ' || rec.solde_restant::text || ' GNF à régler.',
      'alerte',
      '/parent/dashboard'
    );
  END LOOP;
END;
$$;
