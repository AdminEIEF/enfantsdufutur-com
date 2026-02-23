
-- Trigger: notify staff + log when RDV is fixed on a pre-inscription
CREATE OR REPLACE FUNCTION public.notify_rdv_fixed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.statut = 'rdv_fixe' AND (OLD.statut IS NULL OR OLD.statut != 'rdv_fixe') AND NEW.date_rdv IS NOT NULL THEN
    -- Staff notification
    INSERT INTO public.notifications (titre, message, destinataire_type, type)
    VALUES (
      '📅 RDV pré-inscription fixé',
      'RDV fixé pour ' || NEW.prenom_eleve || ' ' || NEW.nom_eleve || ' le ' || to_char(NEW.date_rdv, 'DD/MM/YYYY à HH24:MI') || '. Parent: ' || NEW.nom_parent || ' (Tél: ' || NEW.telephone_parent || ').',
      'staff',
      'info'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_pre_inscription_rdv_fixed
AFTER UPDATE ON public.pre_inscriptions
FOR EACH ROW
EXECUTE FUNCTION public.notify_rdv_fixed();
