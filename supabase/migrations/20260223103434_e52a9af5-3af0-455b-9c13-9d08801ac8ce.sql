
CREATE OR REPLACE FUNCTION public.notify_new_pre_inscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (titre, message, destinataire_type, type)
  VALUES (
    '📝 Nouvelle pré-inscription',
    'Demande de pré-inscription pour ' || NEW.prenom_eleve || ' ' || NEW.nom_eleve || ' (Parent: ' || NEW.nom_parent || ', Tél: ' || NEW.telephone_parent || ').',
    'staff',
    'info'
  );
  RETURN NEW;
END;
$function$;
