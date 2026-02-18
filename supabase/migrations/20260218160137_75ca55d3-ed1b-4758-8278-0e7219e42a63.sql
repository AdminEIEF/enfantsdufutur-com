-- Drop old restrictive check constraint and replace with one that covers all used types
ALTER TABLE public.paiements DROP CONSTRAINT IF EXISTS paiements_type_paiement_check;

ALTER TABLE public.paiements ADD CONSTRAINT paiements_type_paiement_check 
CHECK (type_paiement = ANY (ARRAY[
  'scolarite'::text, 
  'transport'::text, 
  'cantine'::text, 
  'boutique'::text, 
  'fournitures'::text, 
  'uniforme'::text, 
  'inscription'::text, 
  'reinscription'::text, 
  'librairie'::text, 
  'autre'::text
]));