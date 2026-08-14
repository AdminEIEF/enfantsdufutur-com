UPDATE public.parametres
SET valeur = jsonb_set(
      jsonb_set(valeur::jsonb, '{nom}', '"Les Ecoles la Mame Plus"'::jsonb, true),
      '{logo_url}', '"https://xlrlelzqasgqaiylldcj.supabase.co/storage/v1/object/public/support-images/branding/logo-mame-plus.png"'::jsonb, true
    )
WHERE cle = 'school_config';