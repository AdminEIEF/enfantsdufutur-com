
-- Trigger: notify when a new depense is submitted (alert comptable/admin)
CREATE OR REPLACE FUNCTION public.notify_depense_soumise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.statut = 'soumise' THEN
    INSERT INTO public.notifications (titre, message, destinataire_type, type)
    VALUES (
      '📋 Nouvelle demande de dépense',
      'Demande : "' || NEW.libelle || '" — ' || NEW.montant::text || ' GNF (Service: ' || NEW.service || '). En attente de validation.',
      'admin',
      'action'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_depense_soumise
AFTER INSERT ON public.depenses
FOR EACH ROW
EXECUTE FUNCTION public.notify_depense_soumise();

-- Trigger: notify when depense is validated or rejected (feedback to submitter + admin)
CREATE OR REPLACE FUNCTION public.notify_depense_validee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.statut = 'soumise' AND NEW.statut IN ('validee', 'rejetee') THEN
    INSERT INTO public.notifications (titre, message, destinataire_type, type)
    VALUES (
      CASE NEW.statut 
        WHEN 'validee' THEN '✅ Dépense validée — Récupérez les fonds'
        ELSE '❌ Dépense rejetée'
      END,
      CASE NEW.statut
        WHEN 'validee' THEN 'La demande "' || NEW.libelle || '" de ' || NEW.montant::text || ' GNF (' || NEW.service || ') a été validée. Vous pouvez récupérer l''argent pour effectuer l''achat.'
        ELSE 'La demande "' || NEW.libelle || '" de ' || NEW.montant::text || ' GNF (' || NEW.service || ') a été rejetée.'
      END,
      'admin',
      CASE NEW.statut WHEN 'validee' THEN 'action' ELSE 'alerte' END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_depense_validee
AFTER UPDATE ON public.depenses
FOR EACH ROW
EXECUTE FUNCTION public.notify_depense_validee();
