
-- Supprimer les doublons existants en gardant la première entrée
DELETE FROM public.coordinateur_documents_historique
WHERE id NOT IN (
  SELECT DISTINCT ON (document_id, action) id
  FROM public.coordinateur_documents_historique
  ORDER BY document_id, action, created_at ASC
);

-- Ajouter une contrainte d'unicité sur (document_id, action) pour empêcher les doublons
ALTER TABLE public.coordinateur_documents_historique
ADD CONSTRAINT coordinateur_documents_historique_unique_doc_action
UNIQUE (document_id, action);
