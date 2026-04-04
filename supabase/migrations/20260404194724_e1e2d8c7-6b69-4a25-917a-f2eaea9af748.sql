
CREATE OR REPLACE FUNCTION public.notify_supervisor_transport_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _eleve_nom text;
  _eleve_prenom text;
  _zone_nom text;
BEGIN
  IF NEW.type_paiement = 'transport' THEN
    SELECT e.nom, e.prenom INTO _eleve_nom, _eleve_prenom
    FROM public.eleves e WHERE e.id = NEW.eleve_id;

    SELECT zt.nom INTO _zone_nom
    FROM public.eleves e
    JOIN public.zones_transport zt ON zt.id = e.zone_transport_id
    WHERE e.id = NEW.eleve_id;

    INSERT INTO public.notifications (titre, message, destinataire_type, type)
    VALUES (
      '🚌 Paiement transport reçu',
      'Paiement de ' || NEW.montant::text || ' GNF reçu pour ' || COALESCE(_eleve_prenom, '') || ' ' || COALESCE(_eleve_nom, '') || ' (Zone: ' || COALESCE(_zone_nom, '—') || '). Canal: ' || COALESCE(NEW.canal, 'inconnu') || '. Carte à valider.',
      'admin',
      'action'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_supervisor_transport_payment
  AFTER INSERT ON public.paiements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supervisor_transport_payment();
