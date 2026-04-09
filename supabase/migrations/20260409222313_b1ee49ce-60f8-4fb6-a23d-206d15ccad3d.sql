
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  this_month text;
BEGIN
  this_month := to_char(now(), 'YYYY-MM');

  SELECT json_build_object(
    -- Élèves KPIs
    'total_eleves', (SELECT count(*) FROM eleves WHERE deleted_at IS NULL),
    'total_abandons', (SELECT count(*) FROM eleves WHERE deleted_at IS NULL AND statut = 'abandon'),
    'new_inscriptions_mois', (SELECT count(*) FROM eleves WHERE deleted_at IS NULL AND to_char(created_at, 'YYYY-MM') = this_month),
    
    -- Cantine
    'cantine_inscrits', (SELECT count(*) FROM eleves WHERE deleted_at IS NULL AND option_cantine = true),
    'cantine_solde_faible', (SELECT count(*) FROM eleves WHERE deleted_at IS NULL AND option_cantine = true AND COALESCE(solde_cantine, 0) < 1000),
    
    -- Familles
    'total_familles', (SELECT count(*) FROM familles),
    
    -- Paiements inscription/reinscription
    'total_inscriptions_paiements', (SELECT count(*) FROM paiements WHERE type_paiement = 'inscription'),
    'total_reinscriptions_paiements', (SELECT count(*) FROM paiements WHERE type_paiement = 'reinscription'),
    
    -- Finance totaux
    'total_recettes', (SELECT COALESCE(sum(montant), 0) FROM paiements),
    'total_depenses', (SELECT COALESCE(sum(montant), 0) FROM depenses),
    'recettes_mois', (SELECT COALESCE(sum(montant), 0) FROM paiements WHERE to_char(date_paiement::timestamp, 'YYYY-MM') = this_month),
    'depenses_mois', (SELECT COALESCE(sum(montant), 0) FROM depenses WHERE to_char(date_depense::timestamp, 'YYYY-MM') = this_month),
    
    -- CA Librairie
    'ca_librairie', (SELECT COALESCE(sum(prix_unitaire * quantite), 0) FROM ventes_articles),
    'ca_scolarite', (SELECT COALESCE(sum(montant), 0) FROM paiements WHERE type_paiement = 'scolarite'),
    
    -- Effectif par cycle
    'effectif_par_cycle', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT COALESCE(cy.nom, 'Non affecté') as name, count(*) as value
        FROM eleves e
        LEFT JOIN classes c ON c.id = e.classe_id
        LEFT JOIN niveaux n ON n.id = c.niveau_id
        LEFT JOIN cycles cy ON cy.id = n.cycle_id
        WHERE e.deleted_at IS NULL
        GROUP BY cy.nom
        ORDER BY min(cy.ordre) NULLS LAST
      ) t
    ),
    
    -- Recettes par type
    'recettes_par_type', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT type_paiement as name, sum(montant) as value
        FROM paiements GROUP BY type_paiement ORDER BY sum(montant) DESC
      ) t
    ),
    
    -- Dépenses par service
    'depenses_par_service', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT service as name, sum(montant) as value
        FROM depenses GROUP BY service ORDER BY sum(montant) DESC
      ) t
    ),
    
    -- Tendance 6 mois
    'monthly_trend', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.mois_key), '[]'::json) FROM (
        SELECT m.mois_key,
          to_char(to_date(m.mois_key, 'YYYY-MM'), 'Mon') as mois,
          COALESCE((SELECT sum(montant) FROM paiements WHERE to_char(date_paiement::timestamp, 'YYYY-MM') = m.mois_key), 0) as recettes,
          COALESCE((SELECT sum(montant) FROM depenses WHERE to_char(date_depense::timestamp, 'YYYY-MM') = m.mois_key), 0) as depenses
        FROM (
          SELECT to_char(generate_series(
            date_trunc('month', now()) - interval '5 months',
            date_trunc('month', now()),
            interval '1 month'
          ), 'YYYY-MM') as mois_key
        ) m
      ) t
    ),
    
    -- Recouvrement par classe
    'recouvrement_par_classe', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT 
          c.id as classe_id, c.nom, cy.nom as cycle_nom,
          count(e.id) as effectif,
          sum(COALESCE(n.frais_scolarite, 0)) as total_attendu,
          COALESCE(sum(paid.total_paye), 0) as total_paye,
          CASE WHEN sum(COALESCE(n.frais_scolarite, 0)) > 0 
            THEN round(COALESCE(sum(paid.total_paye), 0) / sum(n.frais_scolarite) * 100)
            ELSE 0 END as taux
        FROM eleves e
        JOIN classes c ON c.id = e.classe_id
        JOIN niveaux n ON n.id = c.niveau_id
        JOIN cycles cy ON cy.id = n.cycle_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(sum(p.montant), 0) as total_paye
          FROM paiements p WHERE p.eleve_id = e.id AND p.type_paiement = 'scolarite'
        ) paid ON true
        WHERE e.deleted_at IS NULL
        GROUP BY c.id, c.nom, cy.nom, cy.ordre
        HAVING sum(COALESCE(n.frais_scolarite, 0)) > 0
        ORDER BY cy.ordre, c.nom
      ) t
    ),

    -- Notes count
    'notes_count', (SELECT count(*) FROM notes)
    
  ) INTO result;
  
  RETURN result;
END;
$$;
