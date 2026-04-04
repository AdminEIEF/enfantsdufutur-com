
-- ELEVES
CREATE INDEX IF NOT EXISTS idx_eleves_classe_id ON public.eleves (classe_id);
CREATE INDEX IF NOT EXISTS idx_eleves_famille_id ON public.eleves (famille_id);
CREATE INDEX IF NOT EXISTS idx_eleves_statut ON public.eleves (statut);
CREATE INDEX IF NOT EXISTS idx_eleves_matricule ON public.eleves (matricule);
CREATE INDEX IF NOT EXISTS idx_eleves_deleted_at ON public.eleves (deleted_at);
CREATE INDEX IF NOT EXISTS idx_eleves_session_id ON public.eleves (session_id);
CREATE INDEX IF NOT EXISTS idx_eleves_nom_prenom ON public.eleves (nom, prenom);
CREATE INDEX IF NOT EXISTS idx_eleves_zone_transport ON public.eleves (zone_transport_id);

-- PAIEMENTS
CREATE INDEX IF NOT EXISTS idx_paiements_eleve_id ON public.paiements (eleve_id);
CREATE INDEX IF NOT EXISTS idx_paiements_type ON public.paiements (type_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_created_at ON public.paiements (created_at DESC);

-- NOTES
CREATE INDEX IF NOT EXISTS idx_notes_eleve_id ON public.notes (eleve_id);
CREATE INDEX IF NOT EXISTS idx_notes_matiere_id ON public.notes (matiere_id);
CREATE INDEX IF NOT EXISTS idx_notes_periode_id ON public.notes (periode_id);

-- FAMILLES
CREATE INDEX IF NOT EXISTS idx_familles_nom ON public.familles (nom_famille);
CREATE INDEX IF NOT EXISTS idx_familles_tel_pere ON public.familles (telephone_pere);

-- EMPLOYES
CREATE INDEX IF NOT EXISTS idx_employes_categorie ON public.employes (categorie);
CREATE INDEX IF NOT EXISTS idx_employes_statut ON public.employes (statut);
CREATE INDEX IF NOT EXISTS idx_employes_matricule ON public.employes (matricule);

-- DEPENSES
CREATE INDEX IF NOT EXISTS idx_depenses_service ON public.depenses (service);
CREATE INDEX IF NOT EXISTS idx_depenses_statut ON public.depenses (statut);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON public.depenses (date_depense DESC);

-- COMPOSITIONS
CREATE INDEX IF NOT EXISTS idx_compositions_classe_id ON public.compositions (classe_id);
CREATE INDEX IF NOT EXISTS idx_compositions_matiere_id ON public.compositions (matiere_id);
CREATE INDEX IF NOT EXISTS idx_compositions_dates ON public.compositions (date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_compositions_publie ON public.compositions (publie);
CREATE INDEX IF NOT EXISTS idx_comp_reponses_eleve ON public.composition_reponses (eleve_id);
CREATE INDEX IF NOT EXISTS idx_comp_reponses_comp ON public.composition_reponses (composition_id);
CREATE INDEX IF NOT EXISTS idx_comp_questions_comp ON public.composition_questions (composition_id);

-- DEVOIRS & COURS
CREATE INDEX IF NOT EXISTS idx_devoirs_classe_id ON public.devoirs (classe_id);
CREATE INDEX IF NOT EXISTS idx_devoirs_matiere_id ON public.devoirs (matiere_id);
CREATE INDEX IF NOT EXISTS idx_cours_classe_id ON public.cours (classe_id);
CREATE INDEX IF NOT EXISTS idx_cours_matiere_id ON public.cours (matiere_id);

-- ENSEIGNANT CLASSES
CREATE INDEX IF NOT EXISTS idx_enseignant_classes_employe ON public.enseignant_classes (employe_id);
CREATE INDEX IF NOT EXISTS idx_enseignant_classes_classe ON public.enseignant_classes (classe_id);

-- EMPLOI DU TEMPS
CREATE INDEX IF NOT EXISTS idx_edt_classe_id ON public.emploi_du_temps (classe_id);
CREATE INDEX IF NOT EXISTS idx_edt_jour ON public.emploi_du_temps (jour_semaine);

-- NOTIFICATIONS
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (destinataire_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_notif_eleve ON public.student_notifications (eleve_id);
CREATE INDEX IF NOT EXISTS idx_student_notif_lu ON public.student_notifications (lu);
CREATE INDEX IF NOT EXISTS idx_parent_notif_famille ON public.parent_notifications (famille_id);
CREATE INDEX IF NOT EXISTS idx_employee_notif_employe ON public.employee_notifications (employe_id);

-- AVANCES & BULLETINS PAIE
CREATE INDEX IF NOT EXISTS idx_avances_employe ON public.avances_salaire (employe_id);
CREATE INDEX IF NOT EXISTS idx_avances_statut ON public.avances_salaire (statut);
CREATE INDEX IF NOT EXISTS idx_bulletins_paie_employe ON public.bulletins_paie (employe_id);
CREATE INDEX IF NOT EXISTS idx_bulletins_paie_mois ON public.bulletins_paie (annee, mois);

-- CONGES
CREATE INDEX IF NOT EXISTS idx_conges_employe ON public.conges (employe_id);
CREATE INDEX IF NOT EXISTS idx_conges_statut ON public.conges (statut);

-- CLASSES & NIVEAUX
CREATE INDEX IF NOT EXISTS idx_classes_niveau_id ON public.classes (niveau_id);
CREATE INDEX IF NOT EXISTS idx_niveaux_cycle_id ON public.niveaux (cycle_id);

-- TRANSPORT
CREATE INDEX IF NOT EXISTS idx_checkin_transport_eleve ON public.checkin_transport (eleve_id);
CREATE INDEX IF NOT EXISTS idx_checkin_transport_date ON public.checkin_transport (date_checkin);
CREATE INDEX IF NOT EXISTS idx_arrets_route ON public.arrets_transport (route_id);
CREATE INDEX IF NOT EXISTS idx_bus_positions_vehicule ON public.bus_positions (vehicule_id);

-- AUDIT LOG
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log (user_id);

-- BOUTIQUE
CREATE INDEX IF NOT EXISTS idx_boutique_ventes_eleve ON public.boutique_ventes (eleve_id);
CREATE INDEX IF NOT EXISTS idx_boutique_vente_items_vente ON public.boutique_vente_items (vente_id);

-- COMMANDES
CREATE INDEX IF NOT EXISTS idx_commandes_eleve ON public.commandes_articles (eleve_id);
CREATE INDEX IF NOT EXISTS idx_commandes_statut ON public.commandes_articles (statut);

-- EVENEMENTS
CREATE INDEX IF NOT EXISTS idx_evenements_date ON public.evenements_calendrier (date_debut);
CREATE INDEX IF NOT EXISTS idx_evenements_classe ON public.evenements_calendrier (classe_id);

-- ACTIVE CONNECTIONS
CREATE INDEX IF NOT EXISTS idx_active_conn_ref ON public.active_connections (ref_id);
CREATE INDEX IF NOT EXISTS idx_active_conn_type ON public.active_connections (type);

-- CLASSE MATIERES
CREATE INDEX IF NOT EXISTS idx_classe_matieres_classe ON public.classe_matieres (classe_id);
CREATE INDEX IF NOT EXISTS idx_classe_matieres_matiere ON public.classe_matieres (matiere_id);

-- BULLETIN PUBLICATIONS
CREATE INDEX IF NOT EXISTS idx_bulletin_pub_classe ON public.bulletin_publications (classe_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_pub_periode ON public.bulletin_publications (periode_id);

-- COORDINATEUR
CREATE INDEX IF NOT EXISTS idx_coord_docs_eleve ON public.coordinateur_documents (eleve_id);
CREATE INDEX IF NOT EXISTS idx_coord_eleves_statut ON public.coordinateur_eleves (statut);

-- PRE-INSCRIPTIONS
CREATE INDEX IF NOT EXISTS idx_pre_inscriptions_statut ON public.pre_inscriptions (statut);
