-- Index sur eleves: filtrage par classe, famille, session, statut, deleted_at
CREATE INDEX IF NOT EXISTS idx_eleves_classe_id ON public.eleves(classe_id);
CREATE INDEX IF NOT EXISTS idx_eleves_famille_id ON public.eleves(famille_id);
CREATE INDEX IF NOT EXISTS idx_eleves_session_id ON public.eleves(session_id);
CREATE INDEX IF NOT EXISTS idx_eleves_statut ON public.eleves(statut);
CREATE INDEX IF NOT EXISTS idx_eleves_deleted_at ON public.eleves(deleted_at);
CREATE INDEX IF NOT EXISTS idx_eleves_classe_deleted ON public.eleves(classe_id, deleted_at);

-- Index sur paiements: filtrage par élève, type, date
CREATE INDEX IF NOT EXISTS idx_paiements_eleve_id ON public.paiements(eleve_id);
CREATE INDEX IF NOT EXISTS idx_paiements_type ON public.paiements(type_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON public.paiements(date_paiement);
CREATE INDEX IF NOT EXISTS idx_paiements_session_id ON public.paiements(session_id);

-- Index sur notes: filtrage par élève, matière, période
CREATE INDEX IF NOT EXISTS idx_notes_eleve_id ON public.notes(eleve_id);
CREATE INDEX IF NOT EXISTS idx_notes_matiere_id ON public.notes(matiere_id);
CREATE INDEX IF NOT EXISTS idx_notes_periode_id ON public.notes(periode_id);

-- Index sur employes: filtrage par statut, catégorie
CREATE INDEX IF NOT EXISTS idx_employes_statut ON public.employes(statut);
CREATE INDEX IF NOT EXISTS idx_employes_categorie ON public.employes(categorie);

-- Index sur classes: filtrage par niveau
CREATE INDEX IF NOT EXISTS idx_classes_niveau_id ON public.classes(niveau_id);

-- Index sur niveaux: filtrage par cycle
CREATE INDEX IF NOT EXISTS idx_niveaux_cycle_id ON public.niveaux(cycle_id);

-- Index sur emploi_du_temps: filtrage par classe, jour
CREATE INDEX IF NOT EXISTS idx_emploi_du_temps_classe_id ON public.emploi_du_temps(classe_id);
CREATE INDEX IF NOT EXISTS idx_emploi_du_temps_jour ON public.emploi_du_temps(jour_semaine);

-- Index sur enseignant_classes: filtrage par employé, classe
CREATE INDEX IF NOT EXISTS idx_enseignant_classes_employe_id ON public.enseignant_classes(employe_id);
CREATE INDEX IF NOT EXISTS idx_enseignant_classes_classe_id ON public.enseignant_classes(classe_id);

-- Index sur pointages_eleves: filtrage par date
CREATE INDEX IF NOT EXISTS idx_pointages_eleves_date ON public.pointages_eleves(date_pointage);

-- Index sur pointages_employes: filtrage par date
CREATE INDEX IF NOT EXISTS idx_pointages_employes_date ON public.pointages_employes(date_pointage);

-- Index sur depenses: filtrage par service, date, statut
CREATE INDEX IF NOT EXISTS idx_depenses_service ON public.depenses(service);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON public.depenses(date_depense);
CREATE INDEX IF NOT EXISTS idx_depenses_statut ON public.depenses(statut);

-- Index sur notifications: filtrage par destinataire
CREATE INDEX IF NOT EXISTS idx_notifications_destinataire ON public.notifications(destinataire_type, destinataire_ref);

-- Index sur parent_notifications: filtrage par famille
CREATE INDEX IF NOT EXISTS idx_parent_notifications_famille ON public.parent_notifications(famille_id);

-- Index sur employee_notifications: filtrage par employé
CREATE INDEX IF NOT EXISTS idx_employee_notifications_employe ON public.employee_notifications(employe_id);

-- Index sur devoirs: filtrage par classe, matière
CREATE INDEX IF NOT EXISTS idx_devoirs_classe_id ON public.devoirs(classe_id);
CREATE INDEX IF NOT EXISTS idx_devoirs_matiere_id ON public.devoirs(matiere_id);

-- Index sur cours: filtrage par classe, matière
CREATE INDEX IF NOT EXISTS idx_cours_classe_id ON public.cours(classe_id);
CREATE INDEX IF NOT EXISTS idx_cours_matiere_id ON public.cours(matiere_id);

-- Index sur commandes_articles: filtrage par élève, statut
CREATE INDEX IF NOT EXISTS idx_commandes_articles_eleve_id ON public.commandes_articles(eleve_id);
CREATE INDEX IF NOT EXISTS idx_commandes_articles_statut ON public.commandes_articles(statut);

-- Index sur conges: filtrage par employé
CREATE INDEX IF NOT EXISTS idx_conges_employe_id ON public.conges(employe_id);

-- Index sur avances_salaire: filtrage par employé
CREATE INDEX IF NOT EXISTS idx_avances_salaire_employe_id ON public.avances_salaire(employe_id);

-- Index sur active_connections: filtrage par type, ref_id
CREATE INDEX IF NOT EXISTS idx_active_connections_type ON public.active_connections(type);
CREATE INDEX IF NOT EXISTS idx_active_connections_ref ON public.active_connections(ref_id);

-- Index sur checkin_transport: filtrage par élève, date
CREATE INDEX IF NOT EXISTS idx_checkin_transport_eleve_id ON public.checkin_transport(eleve_id);
CREATE INDEX IF NOT EXISTS idx_checkin_transport_date ON public.checkin_transport(date_checkin);

-- Index sur compositions: filtrage par classe
CREATE INDEX IF NOT EXISTS idx_compositions_classe_id ON public.compositions(classe_id);

-- Index sur familles: recherche par nom
CREATE INDEX IF NOT EXISTS idx_familles_nom ON public.familles(nom_famille);

-- Index sur eleves: zone transport
CREATE INDEX IF NOT EXISTS idx_eleves_zone_transport ON public.eleves(zone_transport_id);