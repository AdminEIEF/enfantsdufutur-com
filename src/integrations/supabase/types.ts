export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      active_connections: {
        Row: {
          categorie: string | null
          classe_nom: string | null
          connected_at: string
          cycle_nom: string | null
          display_name: string
          email: string | null
          extra_info: Json | null
          id: string
          last_seen_at: string
          niveau_nom: string | null
          poste: string | null
          ref_id: string
          type: string
        }
        Insert: {
          categorie?: string | null
          classe_nom?: string | null
          connected_at?: string
          cycle_nom?: string | null
          display_name: string
          email?: string | null
          extra_info?: Json | null
          id?: string
          last_seen_at?: string
          niveau_nom?: string | null
          poste?: string | null
          ref_id: string
          type: string
        }
        Update: {
          categorie?: string | null
          classe_nom?: string | null
          connected_at?: string
          cycle_nom?: string | null
          display_name?: string
          email?: string | null
          extra_info?: Json | null
          id?: string
          last_seen_at?: string
          niveau_nom?: string | null
          poste?: string | null
          ref_id?: string
          type?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          categorie: string
          created_at: string
          id: string
          niveau_id: string | null
          nom: string
          prix: number
          seuil_alerte_stock: number
          stock: number
          updated_at: string
        }
        Insert: {
          categorie: string
          created_at?: string
          id?: string
          niveau_id?: string | null
          nom: string
          prix?: number
          seuil_alerte_stock?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          categorie?: string
          created_at?: string
          id?: string
          niveau_id?: string | null
          nom?: string
          prix?: number
          seuil_alerte_stock?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      avances_salaire: {
        Row: {
          created_at: string
          employe_id: string
          id: string
          mois_remboursement: string | null
          montant: number
          montant_rembourse: number
          motif: string | null
          statut: string
          traite_at: string | null
          traite_par: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employe_id: string
          id?: string
          mois_remboursement?: string | null
          montant: number
          montant_rembourse?: number
          motif?: string | null
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employe_id?: string
          id?: string
          mois_remboursement?: string | null
          montant?: number
          montant_rembourse?: number
          motif?: string | null
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avances_salaire_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      boutique_articles: {
        Row: {
          categorie: string
          created_at: string
          id: string
          nom: string
          prix: number
          seuil_alerte_stock: number
          stock: number
          taille: string
          updated_at: string
        }
        Insert: {
          categorie: string
          created_at?: string
          id?: string
          nom: string
          prix?: number
          seuil_alerte_stock?: number
          stock?: number
          taille?: string
          updated_at?: string
        }
        Update: {
          categorie?: string
          created_at?: string
          id?: string
          nom?: string
          prix?: number
          seuil_alerte_stock?: number
          stock?: number
          taille?: string
          updated_at?: string
        }
        Relationships: []
      }
      boutique_vente_items: {
        Row: {
          article_id: string
          created_at: string
          id: string
          prix_unitaire: number
          quantite: number
          vente_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          prix_unitaire: number
          quantite?: number
          vente_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          prix_unitaire?: number
          quantite?: number
          vente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boutique_vente_items_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "boutique_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boutique_vente_items_vente_id_fkey"
            columns: ["vente_id"]
            isOneToOne: false
            referencedRelation: "boutique_ventes"
            referencedColumns: ["id"]
          },
        ]
      }
      boutique_ventes: {
        Row: {
          created_at: string
          created_by: string | null
          eleve_id: string
          id: string
          montant_final: number
          montant_total: number
          remise_pct: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eleve_id: string
          id?: string
          montant_final?: number
          montant_total?: number
          remise_pct?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eleve_id?: string
          id?: string
          montant_final?: number
          montant_total?: number
          remise_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "boutique_ventes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletin_publications: {
        Row: {
          classe_id: string
          created_at: string
          id: string
          periode_id: string
          published_at: string | null
          published_by: string | null
          visible_parent: boolean
        }
        Insert: {
          classe_id: string
          created_at?: string
          id?: string
          periode_id: string
          published_at?: string | null
          published_by?: string | null
          visible_parent?: boolean
        }
        Update: {
          classe_id?: string
          created_at?: string
          id?: string
          periode_id?: string
          published_at?: string | null
          published_by?: string | null
          visible_parent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bulletin_publications_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulletin_publications_periode_id_fkey"
            columns: ["periode_id"]
            isOneToOne: false
            referencedRelation: "periodes"
            referencedColumns: ["id"]
          },
        ]
      }
      bulletins_paie: {
        Row: {
          annee: number
          avances_deduites: number
          commentaire: string | null
          created_at: string
          employe_id: string
          genere_par: string | null
          id: string
          mois: number
          primes: number
          retenues: number
          salaire_brut: number
          salaire_net: number
        }
        Insert: {
          annee: number
          avances_deduites?: number
          commentaire?: string | null
          created_at?: string
          employe_id: string
          genere_par?: string | null
          id?: string
          mois: number
          primes?: number
          retenues?: number
          salaire_brut?: number
          salaire_net?: number
        }
        Update: {
          annee?: number
          avances_deduites?: number
          commentaire?: string | null
          created_at?: string
          employe_id?: string
          genere_par?: string | null
          id?: string
          mois?: number
          primes?: number
          retenues?: number
          salaire_brut?: number
          salaire_net?: number
        }
        Relationships: [
          {
            foreignKeyName: "bulletins_paie_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          capacite: number | null
          created_at: string
          id: string
          niveau_id: string
          nom: string
        }
        Insert: {
          capacite?: number | null
          created_at?: string
          id?: string
          niveau_id: string
          nom: string
        }
        Update: {
          capacite?: number | null
          created_at?: string
          id?: string
          niveau_id?: string
          nom?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux"
            referencedColumns: ["id"]
          },
        ]
      }
      commandes_articles: {
        Row: {
          article_nom: string
          article_taille: string | null
          article_type: string
          created_at: string
          eleve_id: string
          id: string
          livre_at: string | null
          livre_par: string | null
          prix_unitaire: number
          quantite: number
          source: string
          statut: string
          updated_at: string
        }
        Insert: {
          article_nom: string
          article_taille?: string | null
          article_type?: string
          created_at?: string
          eleve_id: string
          id?: string
          livre_at?: string | null
          livre_par?: string | null
          prix_unitaire?: number
          quantite?: number
          source?: string
          statut?: string
          updated_at?: string
        }
        Update: {
          article_nom?: string
          article_taille?: string | null
          article_type?: string
          created_at?: string
          eleve_id?: string
          id?: string
          livre_at?: string | null
          livre_par?: string | null
          prix_unitaire?: number
          quantite?: number
          source?: string
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commandes_articles_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      conges: {
        Row: {
          created_at: string
          date_debut: string
          date_fin: string
          employe_id: string
          id: string
          motif: string | null
          statut: string
          traite_at: string | null
          traite_par: string | null
          type_conge: string
        }
        Insert: {
          created_at?: string
          date_debut: string
          date_fin: string
          employe_id: string
          id?: string
          motif?: string | null
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          type_conge?: string
        }
        Update: {
          created_at?: string
          date_debut?: string
          date_fin?: string
          employe_id?: string
          id?: string
          motif?: string | null
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          type_conge?: string
        }
        Relationships: [
          {
            foreignKeyName: "conges_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinateur_documents: {
        Row: {
          created_at: string
          date_depot: string | null
          date_retrait: string | null
          eleve_id: string
          id: string
          note_retrait: string | null
          statut: string
          telephone_retrait: string | null
          type_document: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_depot?: string | null
          date_retrait?: string | null
          eleve_id: string
          id?: string
          note_retrait?: string | null
          statut?: string
          telephone_retrait?: string | null
          type_document: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_depot?: string | null
          date_retrait?: string | null
          eleve_id?: string
          id?: string
          note_retrait?: string | null
          statut?: string
          telephone_retrait?: string | null
          type_document?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinateur_documents_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "coordinateur_eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinateur_documents_historique: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          document_id: string
          eleve_id: string
          id: string
          note: string | null
          telephone: string | null
          type_document: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          document_id: string
          eleve_id: string
          id?: string
          note?: string | null
          telephone?: string | null
          type_document: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          document_id?: string
          eleve_id?: string
          id?: string
          note?: string | null
          telephone?: string | null
          type_document?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordinateur_documents_historique_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "coordinateur_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coordinateur_documents_historique_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "coordinateur_eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      coordinateur_eleves: {
        Row: {
          created_at: string
          created_by: string | null
          ecole_provenance: string
          id: string
          niveau_scolaire: string
          nom: string
          pre_inscription_id: string | null
          prenom: string
          statut: string
          updated_at: string
          valide: boolean
          valide_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ecole_provenance?: string
          id?: string
          niveau_scolaire?: string
          nom: string
          pre_inscription_id?: string | null
          prenom: string
          statut?: string
          updated_at?: string
          valide?: boolean
          valide_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ecole_provenance?: string
          id?: string
          niveau_scolaire?: string
          nom?: string
          pre_inscription_id?: string | null
          prenom?: string
          statut?: string
          updated_at?: string
          valide?: boolean
          valide_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coordinateur_eleves_pre_inscription_id_fkey"
            columns: ["pre_inscription_id"]
            isOneToOne: false
            referencedRelation: "pre_inscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      courriers_employes: {
        Row: {
          contenu: string
          created_at: string
          employe_id: string
          fichier_nom: string | null
          fichier_url: string | null
          id: string
          objet: string
          reponse: string | null
          statut: string
          traite_at: string | null
          traite_par: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contenu: string
          created_at?: string
          employe_id: string
          fichier_nom?: string | null
          fichier_url?: string | null
          id?: string
          objet: string
          reponse?: string | null
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          contenu?: string
          created_at?: string
          employe_id?: string
          fichier_nom?: string | null
          fichier_url?: string | null
          id?: string
          objet?: string
          reponse?: string | null
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courriers_employes_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      cours: {
        Row: {
          classe_id: string
          contenu_url: string
          created_at: string
          created_by: string | null
          description: string | null
          fichier_nom: string | null
          id: string
          matiere_id: string
          titre: string
          type_contenu: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          classe_id: string
          contenu_url: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fichier_nom?: string | null
          id?: string
          matiere_id: string
          titre: string
          type_contenu?: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          classe_id?: string
          contenu_url?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fichier_nom?: string | null
          id?: string
          matiere_id?: string
          titre?: string
          type_contenu?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cours_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cours_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          bareme: number
          created_at: string
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          bareme?: number
          created_at?: string
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          bareme?: number
          created_at?: string
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      depenses: {
        Row: {
          created_at: string
          created_by: string | null
          date_depense: string
          fournisseur_id: string | null
          id: string
          libelle: string
          montant: number
          service: string
          sous_categorie: string | null
          statut: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_depense?: string
          fournisseur_id?: string | null
          id?: string
          libelle: string
          montant: number
          service: string
          sous_categorie?: string | null
          statut?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_depense?: string
          fournisseur_id?: string | null
          id?: string
          libelle?: string
          montant?: number
          service?: string
          sous_categorie?: string | null
          statut?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depenses_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      devoirs: {
        Row: {
          classe_id: string
          created_at: string
          created_by: string | null
          date_limite: string
          description: string | null
          id: string
          matiere_id: string
          note_max: number
          titre: string
          type_devoir: string
          updated_at: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          created_by?: string | null
          date_limite: string
          description?: string | null
          id?: string
          matiere_id: string
          note_max?: number
          titre: string
          type_devoir?: string
          updated_at?: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          created_by?: string | null
          date_limite?: string
          description?: string | null
          id?: string
          matiere_id?: string
          note_max?: number
          titre?: string
          type_devoir?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devoirs_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoirs_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      eleves: {
        Row: {
          checklist_livret: boolean | null
          checklist_marqueurs: boolean | null
          checklist_photo: boolean | null
          checklist_rames: boolean | null
          classe_id: string | null
          created_at: string
          date_naissance: string | null
          deleted_at: string | null
          famille_id: string | null
          id: string
          matricule: string | null
          mot_de_passe_eleve: string | null
          nom: string
          nom_prenom_mere: string | null
          nom_prenom_pere: string | null
          option_cantine: boolean | null
          option_fournitures: boolean | null
          option_robotique: boolean | null
          photo_url: string | null
          prenom: string
          qr_code: string | null
          robotique_paye: boolean | null
          sexe: string | null
          solde_cantine: number | null
          statut: string
          transport_zone: string | null
          uniforme_karate: boolean | null
          uniforme_polo_lacoste: boolean | null
          uniforme_scolaire: boolean | null
          uniforme_scout: boolean | null
          uniforme_sport: boolean | null
          updated_at: string
          zone_transport_id: string | null
        }
        Insert: {
          checklist_livret?: boolean | null
          checklist_marqueurs?: boolean | null
          checklist_photo?: boolean | null
          checklist_rames?: boolean | null
          classe_id?: string | null
          created_at?: string
          date_naissance?: string | null
          deleted_at?: string | null
          famille_id?: string | null
          id?: string
          matricule?: string | null
          mot_de_passe_eleve?: string | null
          nom: string
          nom_prenom_mere?: string | null
          nom_prenom_pere?: string | null
          option_cantine?: boolean | null
          option_fournitures?: boolean | null
          option_robotique?: boolean | null
          photo_url?: string | null
          prenom: string
          qr_code?: string | null
          robotique_paye?: boolean | null
          sexe?: string | null
          solde_cantine?: number | null
          statut?: string
          transport_zone?: string | null
          uniforme_karate?: boolean | null
          uniforme_polo_lacoste?: boolean | null
          uniforme_scolaire?: boolean | null
          uniforme_scout?: boolean | null
          uniforme_sport?: boolean | null
          updated_at?: string
          zone_transport_id?: string | null
        }
        Update: {
          checklist_livret?: boolean | null
          checklist_marqueurs?: boolean | null
          checklist_photo?: boolean | null
          checklist_rames?: boolean | null
          classe_id?: string | null
          created_at?: string
          date_naissance?: string | null
          deleted_at?: string | null
          famille_id?: string | null
          id?: string
          matricule?: string | null
          mot_de_passe_eleve?: string | null
          nom?: string
          nom_prenom_mere?: string | null
          nom_prenom_pere?: string | null
          option_cantine?: boolean | null
          option_fournitures?: boolean | null
          option_robotique?: boolean | null
          photo_url?: string | null
          prenom?: string
          qr_code?: string | null
          robotique_paye?: boolean | null
          sexe?: string | null
          solde_cantine?: number | null
          statut?: string
          transport_zone?: string | null
          uniforme_karate?: boolean | null
          uniforme_polo_lacoste?: boolean | null
          uniforme_scolaire?: boolean | null
          uniforme_scout?: boolean | null
          uniforme_sport?: boolean | null
          updated_at?: string
          zone_transport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eleves_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleves_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleves_zone_transport_id_fkey"
            columns: ["zone_transport_id"]
            isOneToOne: false
            referencedRelation: "zones_transport"
            referencedColumns: ["id"]
          },
        ]
      }
      emploi_du_temps: {
        Row: {
          classe_id: string
          created_at: string
          created_by: string | null
          enseignant_id: string | null
          heure_debut: string
          heure_fin: string
          id: string
          jour_semaine: number
          matiere_id: string
          salle: string | null
          updated_at: string
        }
        Insert: {
          classe_id: string
          created_at?: string
          created_by?: string | null
          enseignant_id?: string | null
          heure_debut: string
          heure_fin: string
          id?: string
          jour_semaine: number
          matiere_id: string
          salle?: string | null
          updated_at?: string
        }
        Update: {
          classe_id?: string
          created_at?: string
          created_by?: string | null
          enseignant_id?: string | null
          heure_debut?: string
          heure_fin?: string
          id?: string
          jour_semaine?: number
          matiere_id?: string
          salle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emploi_du_temps_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emploi_du_temps_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          employe_id: string
          id: string
          lu: boolean
          message: string
          titre: string
          type: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          employe_id: string
          id?: string
          lu?: boolean
          message: string
          titre: string
          type?: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          employe_id?: string
          id?: string
          lu?: boolean
          message?: string
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_notifications_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      employes: {
        Row: {
          adresse: string | null
          categorie: Database["public"]["Enums"]["categorie_employe"]
          created_at: string
          date_embauche: string
          date_fin_contrat: string | null
          date_naissance: string | null
          email: string | null
          id: string
          matricule: string
          mot_de_passe: string | null
          nom: string
          photo_url: string | null
          poste: string
          prenom: string
          salaire_base: number
          sexe: string | null
          statut: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          categorie?: Database["public"]["Enums"]["categorie_employe"]
          created_at?: string
          date_embauche?: string
          date_fin_contrat?: string | null
          date_naissance?: string | null
          email?: string | null
          id?: string
          matricule: string
          mot_de_passe?: string | null
          nom: string
          photo_url?: string | null
          poste?: string
          prenom: string
          salaire_base?: number
          sexe?: string | null
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          categorie?: Database["public"]["Enums"]["categorie_employe"]
          created_at?: string
          date_embauche?: string
          date_fin_contrat?: string | null
          date_naissance?: string | null
          email?: string | null
          id?: string
          matricule?: string
          mot_de_passe?: string | null
          nom?: string
          photo_url?: string | null
          poste?: string
          prenom?: string
          salaire_base?: number
          sexe?: string | null
          statut?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enseignant_classes: {
        Row: {
          classe_id: string
          created_at: string
          employe_id: string
          id: string
          matiere_id: string | null
        }
        Insert: {
          classe_id: string
          created_at?: string
          employe_id: string
          id?: string
          matiere_id?: string | null
        }
        Update: {
          classe_id?: string
          created_at?: string
          employe_id?: string
          id?: string
          matiere_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enseignant_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enseignant_classes_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enseignant_classes_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_enseignants_eleves: {
        Row: {
          commentaire: string | null
          competences: number
          created_at: string
          eleve_id: string
          enseignant_id: string
          id: string
          pedagogie: number
          periode: string
          ponctualite: number
          relations: number
        }
        Insert: {
          commentaire?: string | null
          competences?: number
          created_at?: string
          eleve_id: string
          enseignant_id: string
          id?: string
          pedagogie?: number
          periode: string
          ponctualite?: number
          relations?: number
        }
        Update: {
          commentaire?: string | null
          competences?: number
          created_at?: string
          eleve_id?: string
          enseignant_id?: string
          id?: string
          pedagogie?: number
          periode?: string
          ponctualite?: number
          relations?: number
        }
        Relationships: [
          {
            foreignKeyName: "eval_enseignants_eleves_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_enseignants_eleves_enseignant_id_fkey"
            columns: ["enseignant_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations_employes: {
        Row: {
          assiduite: number | null
          commentaire: string | null
          competences: number | null
          created_at: string
          employe_id: string
          evalue_par: string | null
          id: string
          initiative: number | null
          pedagogie: number | null
          periode: string
          ponctualite: number | null
          relations: number | null
        }
        Insert: {
          assiduite?: number | null
          commentaire?: string | null
          competences?: number | null
          created_at?: string
          employe_id: string
          evalue_par?: string | null
          id?: string
          initiative?: number | null
          pedagogie?: number | null
          periode: string
          ponctualite?: number | null
          relations?: number | null
        }
        Update: {
          assiduite?: number | null
          commentaire?: string | null
          competences?: number | null
          created_at?: string
          employe_id?: string
          evalue_par?: string | null
          id?: string
          initiative?: number | null
          pedagogie?: number | null
          periode?: string
          ponctualite?: number | null
          relations?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_employes_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      evenements_calendrier: {
        Row: {
          classe_id: string | null
          couleur: string | null
          created_at: string
          created_by: string | null
          date_debut: string
          date_fin: string | null
          description: string | null
          heure_debut: string | null
          heure_fin: string | null
          id: string
          matiere_id: string | null
          titre: string
          type: string
          updated_at: string
        }
        Insert: {
          classe_id?: string | null
          couleur?: string | null
          created_at?: string
          created_by?: string | null
          date_debut: string
          date_fin?: string | null
          description?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          matiere_id?: string | null
          titre: string
          type?: string
          updated_at?: string
        }
        Update: {
          classe_id?: string | null
          couleur?: string | null
          created_at?: string
          created_by?: string | null
          date_debut?: string
          date_fin?: string | null
          description?: string | null
          heure_debut?: string | null
          heure_fin?: string | null
          id?: string
          matiere_id?: string | null
          titre?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evenements_calendrier_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evenements_calendrier_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
        ]
      }
      familles: {
        Row: {
          adresse: string | null
          code_acces: string | null
          created_at: string
          email_parent: string | null
          id: string
          nom_famille: string
          solde_famille: number
          telephone_mere: string | null
          telephone_pere: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          code_acces?: string | null
          created_at?: string
          email_parent?: string | null
          id?: string
          nom_famille: string
          solde_famille?: number
          telephone_mere?: string | null
          telephone_pere?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          code_acces?: string | null
          created_at?: string
          email_parent?: string | null
          id?: string
          nom_famille?: string
          solde_famille?: number
          telephone_mere?: string | null
          telephone_pere?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fournisseurs: {
        Row: {
          adresse: string | null
          categorie: string
          created_at: string
          email: string | null
          id: string
          nom: string
          telephone: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          categorie: string
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          telephone?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          categorie?: string
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          telephone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      justificatifs: {
        Row: {
          created_at: string
          description: string | null
          eleve_id: string | null
          famille_id: string
          fichier_nom: string
          fichier_url: string
          id: string
          statut: string
          traite_at: string | null
          traite_par: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          eleve_id?: string | null
          famille_id: string
          fichier_nom: string
          fichier_url: string
          id?: string
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          eleve_id?: string | null
          famille_id?: string
          fichier_nom?: string
          fichier_url?: string
          id?: string
          statut?: string
          traite_at?: string | null
          traite_par?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "justificatifs_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justificatifs_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      mandataires: {
        Row: {
          created_at: string
          eleve_id: string
          id: string
          lien_parente: string
          nom: string
          ordre: number
          photo_url: string | null
          prenom: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eleve_id: string
          id?: string
          lien_parente: string
          nom: string
          ordre?: number
          photo_url?: string | null
          prenom: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eleve_id?: string
          id?: string
          lien_parente?: string
          nom?: string
          ordre?: number
          photo_url?: string | null
          prenom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandataires_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      matieres: {
        Row: {
          coefficient: number
          created_at: string
          cycle_id: string | null
          id: string
          niveau_id: string | null
          nom: string
          pole: string | null
        }
        Insert: {
          coefficient?: number
          created_at?: string
          cycle_id?: string | null
          id?: string
          niveau_id?: string | null
          nom: string
          pole?: string | null
        }
        Update: {
          coefficient?: number
          created_at?: string
          cycle_id?: string | null
          id?: string
          niveau_id?: string | null
          nom?: string
          pole?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matieres_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matieres_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux"
            referencedColumns: ["id"]
          },
        ]
      }
      niveaux: {
        Row: {
          created_at: string
          cycle_id: string
          frais_assurance: number
          frais_dossier: number
          frais_inscription: number
          frais_reinscription: number
          frais_scolarite: number
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          created_at?: string
          cycle_id: string
          frais_assurance?: number
          frais_dossier?: number
          frais_inscription?: number
          frais_reinscription?: number
          frais_scolarite?: number
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          created_at?: string
          cycle_id?: string
          frais_assurance?: number
          frais_dossier?: number
          frais_inscription?: number
          frais_reinscription?: number
          frais_scolarite?: number
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: [
          {
            foreignKeyName: "niveaux_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          eleve_id: string
          id: string
          matiere_id: string
          note: number | null
          periode_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eleve_id: string
          id?: string
          matiere_id: string
          note?: number | null
          periode_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eleve_id?: string
          id?: string
          matiere_id?: string
          note?: number | null
          periode_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_matiere_id_fkey"
            columns: ["matiere_id"]
            isOneToOne: false
            referencedRelation: "matieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_periode_id_fkey"
            columns: ["periode_id"]
            isOneToOne: false
            referencedRelation: "periodes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          destinataire_ref: string | null
          destinataire_type: string
          id: string
          lu: boolean | null
          message: string
          titre: string
          type: string
        }
        Insert: {
          created_at?: string
          destinataire_ref?: string | null
          destinataire_type: string
          id?: string
          lu?: boolean | null
          message: string
          titre: string
          type?: string
        }
        Update: {
          created_at?: string
          destinataire_ref?: string | null
          destinataire_type?: string
          id?: string
          lu?: boolean | null
          message?: string
          titre?: string
          type?: string
        }
        Relationships: []
      }
      ordres_cantine: {
        Row: {
          canal: string
          code_transaction: string
          created_at: string
          eleve_id: string
          famille_id: string
          id: string
          montant: number
          statut: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          canal?: string
          code_transaction?: string
          created_at?: string
          eleve_id: string
          famille_id: string
          id?: string
          montant: number
          statut?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          canal?: string
          code_transaction?: string
          created_at?: string
          eleve_id?: string
          famille_id?: string
          id?: string
          montant?: number
          statut?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordres_cantine_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordres_cantine_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordres_paiement: {
        Row: {
          canal: string
          code_transaction: string
          created_at: string
          description: string | null
          eleve_id: string | null
          famille_id: string
          id: string
          montant: number
          statut: string
          type_service: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          canal?: string
          code_transaction?: string
          created_at?: string
          description?: string | null
          eleve_id?: string | null
          famille_id: string
          id?: string
          montant: number
          statut?: string
          type_service?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          canal?: string
          code_transaction?: string
          created_at?: string
          description?: string | null
          eleve_id?: string | null
          famille_id?: string
          id?: string
          montant?: number
          statut?: string
          type_service?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordres_paiement_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordres_paiement_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements: {
        Row: {
          banque_nom: string | null
          canal: string
          created_at: string
          created_by: string | null
          date_depot: string | null
          date_paiement: string
          eleve_id: string
          id: string
          mois_concerne: string | null
          montant: number
          preuve_url: string | null
          reference: string | null
          type_paiement: string
        }
        Insert: {
          banque_nom?: string | null
          canal?: string
          created_at?: string
          created_by?: string | null
          date_depot?: string | null
          date_paiement?: string
          eleve_id: string
          id?: string
          mois_concerne?: string | null
          montant: number
          preuve_url?: string | null
          reference?: string | null
          type_paiement: string
        }
        Update: {
          banque_nom?: string | null
          canal?: string
          created_at?: string
          created_by?: string | null
          date_depot?: string | null
          date_paiement?: string
          eleve_id?: string
          id?: string
          mois_concerne?: string | null
          montant?: number
          preuve_url?: string | null
          reference?: string | null
          type_paiement?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      parametres: {
        Row: {
          cle: string
          id: string
          updated_at: string
          valeur: Json
        }
        Insert: {
          cle: string
          id?: string
          updated_at?: string
          valeur?: Json
        }
        Update: {
          cle?: string
          id?: string
          updated_at?: string
          valeur?: Json
        }
        Relationships: []
      }
      parent_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          famille_id: string
          id: string
          lu: boolean
          message: string
          titre: string
          type: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          famille_id: string
          id?: string
          lu?: boolean
          message: string
          titre: string
          type?: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          famille_id?: string
          id?: string
          lu?: boolean
          message?: string
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_notifications_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      periodes: {
        Row: {
          annee_scolaire: string
          created_at: string
          est_rattrapage: boolean | null
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          annee_scolaire?: string
          created_at?: string
          est_rattrapage?: boolean | null
          id?: string
          nom: string
          ordre: number
        }
        Update: {
          annee_scolaire?: string
          created_at?: string
          est_rattrapage?: boolean | null
          id?: string
          nom?: string
          ordre?: number
        }
        Relationships: []
      }
      plats_cantine: {
        Row: {
          actif: boolean
          created_at: string
          date_stock: string
          id: string
          nom: string
          prix: number
          stock_journalier: number
          stock_restant: number
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          date_stock?: string
          id?: string
          nom: string
          prix?: number
          stock_journalier?: number
          stock_restant?: number
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          date_stock?: string
          id?: string
          nom?: string
          prix?: number
          stock_journalier?: number
          stock_restant?: number
          updated_at?: string
        }
        Relationships: []
      }
      pointages_employes: {
        Row: {
          created_at: string
          date_pointage: string
          employe_id: string
          heure_arrivee: string | null
          heure_depart: string | null
          heures_travaillees: number | null
          id: string
          retard: boolean | null
        }
        Insert: {
          created_at?: string
          date_pointage?: string
          employe_id: string
          heure_arrivee?: string | null
          heure_depart?: string | null
          heures_travaillees?: number | null
          id?: string
          retard?: boolean | null
        }
        Update: {
          created_at?: string
          date_pointage?: string
          employe_id?: string
          heure_arrivee?: string | null
          heure_depart?: string | null
          heures_travaillees?: number | null
          id?: string
          retard?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pointages_employes_employe_id_fkey"
            columns: ["employe_id"]
            isOneToOne: false
            referencedRelation: "employes"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_inscriptions: {
        Row: {
          converted_eleve_id: string | null
          converted_famille_id: string | null
          created_at: string
          date_naissance: string | null
          date_rdv: string | null
          email_parent: string | null
          id: string
          niveau_id: string | null
          nom_eleve: string
          nom_parent: string
          notes_admin: string | null
          option_cantine: boolean | null
          option_transport: boolean | null
          option_uniformes: boolean | null
          prenom_eleve: string
          sexe: string | null
          statut: string
          telephone_parent: string
          traite_at: string | null
          traite_par: string | null
          updated_at: string
        }
        Insert: {
          converted_eleve_id?: string | null
          converted_famille_id?: string | null
          created_at?: string
          date_naissance?: string | null
          date_rdv?: string | null
          email_parent?: string | null
          id?: string
          niveau_id?: string | null
          nom_eleve: string
          nom_parent: string
          notes_admin?: string | null
          option_cantine?: boolean | null
          option_transport?: boolean | null
          option_uniformes?: boolean | null
          prenom_eleve: string
          sexe?: string | null
          statut?: string
          telephone_parent: string
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
        }
        Update: {
          converted_eleve_id?: string | null
          converted_famille_id?: string | null
          created_at?: string
          date_naissance?: string | null
          date_rdv?: string | null
          email_parent?: string | null
          id?: string
          niveau_id?: string | null
          nom_eleve?: string
          nom_parent?: string
          notes_admin?: string | null
          option_cantine?: boolean | null
          option_transport?: boolean | null
          option_uniformes?: boolean | null
          prenom_eleve?: string
          sexe?: string | null
          statut?: string
          telephone_parent?: string
          traite_at?: string | null
          traite_par?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_inscriptions_converted_eleve_id_fkey"
            columns: ["converted_eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_inscriptions_converted_famille_id_fkey"
            columns: ["converted_famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_inscriptions_niveau_id_fkey"
            columns: ["niveau_id"]
            isOneToOne: false
            referencedRelation: "niveaux"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blocked: boolean | null
          blocked_at: string | null
          blocked_by: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          must_change_password: boolean
          nom: string
          prenom: string
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          blocked?: boolean | null
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          must_change_password?: boolean
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          blocked?: boolean | null
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          must_change_password?: boolean
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          created_at: string
          devoir_id: string
          id: string
          options: Json
          ordre: number
          points: number
          question: string
          type: string
        }
        Insert: {
          created_at?: string
          devoir_id: string
          id?: string
          options?: Json
          ordre?: number
          points?: number
          question: string
          type?: string
        }
        Update: {
          created_at?: string
          devoir_id?: string
          id?: string
          options?: Json
          ordre?: number
          points?: number
          question?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_devoir_id_fkey"
            columns: ["devoir_id"]
            isOneToOne: false
            referencedRelation: "devoirs"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_reponses: {
        Row: {
          devoir_id: string
          eleve_id: string
          id: string
          reponses: Json
          score: number | null
          score_max: number | null
          soumis_at: string
        }
        Insert: {
          devoir_id: string
          eleve_id: string
          id?: string
          reponses?: Json
          score?: number | null
          score_max?: number | null
          soumis_at?: string
        }
        Update: {
          devoir_id?: string
          eleve_id?: string
          id?: string
          reponses?: Json
          score?: number | null
          score_max?: number | null
          soumis_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_reponses_devoir_id_fkey"
            columns: ["devoir_id"]
            isOneToOne: false
            referencedRelation: "devoirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_reponses_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      recharges_transport: {
        Row: {
          actif: boolean
          created_at: string
          created_by: string | null
          date_expiration: string
          date_recharge: string
          eleve_id: string
          id: string
          montant: number
        }
        Insert: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          date_expiration?: string
          date_recharge?: string
          eleve_id: string
          id?: string
          montant: number
        }
        Update: {
          actif?: boolean
          created_at?: string
          created_by?: string | null
          date_expiration?: string
          date_recharge?: string
          eleve_id?: string
          id?: string
          montant?: number
        }
        Relationships: [
          {
            foreignKeyName: "recharges_transport_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      repas_cantine: {
        Row: {
          created_by: string | null
          date_repas: string
          eleve_id: string
          id: string
          montant_debite: number
          plat_id: string | null
          plat_nom: string | null
        }
        Insert: {
          created_by?: string | null
          date_repas?: string
          eleve_id: string
          id?: string
          montant_debite: number
          plat_id?: string | null
          plat_nom?: string | null
        }
        Update: {
          created_by?: string | null
          date_repas?: string
          eleve_id?: string
          id?: string
          montant_debite?: number
          plat_id?: string | null
          plat_nom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repas_cantine_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repas_cantine_plat_id_fkey"
            columns: ["plat_id"]
            isOneToOne: false
            referencedRelation: "plats_cantine"
            referencedColumns: ["id"]
          },
        ]
      }
      robotics_attendance: {
        Row: {
          created_at: string
          created_by: string | null
          date_seance: string
          eleve_id: string
          id: string
          statut: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_seance?: string
          eleve_id: string
          id?: string
          statut?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_seance?: string
          eleve_id?: string
          id?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "robotics_attendance_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      soumissions_devoirs: {
        Row: {
          commentaire: string | null
          corrige_at: string | null
          corrige_par: string | null
          devoir_id: string
          eleve_id: string
          fichier_nom: string
          fichier_url: string
          id: string
          note: number | null
          soumis_at: string
        }
        Insert: {
          commentaire?: string | null
          corrige_at?: string | null
          corrige_par?: string | null
          devoir_id: string
          eleve_id: string
          fichier_nom: string
          fichier_url: string
          id?: string
          note?: number | null
          soumis_at?: string
        }
        Update: {
          commentaire?: string | null
          corrige_at?: string | null
          corrige_par?: string | null
          devoir_id?: string
          eleve_id?: string
          fichier_nom?: string
          fichier_url?: string
          id?: string
          note?: number | null
          soumis_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "soumissions_devoirs_devoir_id_fkey"
            columns: ["devoir_id"]
            isOneToOne: false
            referencedRelation: "devoirs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soumissions_devoirs_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      student_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          eleve_id: string
          id: string
          lu: boolean
          message: string
          titre: string
          type: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          eleve_id: string
          id?: string
          lu?: boolean
          message: string
          titre: string
          type?: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          eleve_id?: string
          id?: string
          lu?: boolean
          message?: string
          titre?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notifications_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifs: {
        Row: {
          categorie: string
          created_at: string
          cycle_id: string | null
          id: string
          label: string
          montant: number
          updated_at: string
          zone_transport: string | null
        }
        Insert: {
          categorie: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          label: string
          montant?: number
          updated_at?: string
          zone_transport?: string | null
        }
        Update: {
          categorie?: string
          created_at?: string
          cycle_id?: string | null
          id?: string
          label?: string
          montant?: number
          updated_at?: string
          zone_transport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifs_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          connected_at: string
          disconnected_at: string | null
          email: string | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string
          disconnected_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string
          disconnected_at?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      validations_transport: {
        Row: {
          eleve_id: string
          id: string
          motif_rejet: string | null
          recharge_id: string | null
          validated_at: string
          validated_by: string | null
          valide: boolean
          zone_transport_id: string | null
        }
        Insert: {
          eleve_id: string
          id?: string
          motif_rejet?: string | null
          recharge_id?: string | null
          validated_at?: string
          validated_by?: string | null
          valide?: boolean
          zone_transport_id?: string | null
        }
        Update: {
          eleve_id?: string
          id?: string
          motif_rejet?: string | null
          recharge_id?: string | null
          validated_at?: string
          validated_by?: string | null
          valide?: boolean
          zone_transport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validations_transport_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validations_transport_recharge_id_fkey"
            columns: ["recharge_id"]
            isOneToOne: false
            referencedRelation: "recharges_transport"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validations_transport_zone_transport_id_fkey"
            columns: ["zone_transport_id"]
            isOneToOne: false
            referencedRelation: "zones_transport"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes_articles: {
        Row: {
          article_id: string
          created_at: string
          created_by: string | null
          eleve_id: string
          id: string
          prix_unitaire: number
          quantite: number
        }
        Insert: {
          article_id: string
          created_at?: string
          created_by?: string | null
          eleve_id: string
          id?: string
          prix_unitaire: number
          quantite?: number
        }
        Update: {
          article_id?: string
          created_at?: string
          created_by?: string | null
          eleve_id?: string
          id?: string
          prix_unitaire?: number
          quantite?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventes_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_articles_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
        ]
      }
      ventes_credit: {
        Row: {
          article_nom: string
          created_at: string
          created_by: string | null
          description: string | null
          eleve_id: string
          famille_id: string | null
          id: string
          montant_verse: number
          prix_total: number
          solde_restant: number
          statut: string
          updated_at: string
        }
        Insert: {
          article_nom: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eleve_id: string
          famille_id?: string | null
          id?: string
          montant_verse?: number
          prix_total: number
          solde_restant: number
          statut?: string
          updated_at?: string
        }
        Update: {
          article_nom?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          eleve_id?: string
          famille_id?: string | null
          id?: string
          montant_verse?: number
          prix_total?: number
          solde_restant?: number
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventes_credit_eleve_id_fkey"
            columns: ["eleve_id"]
            isOneToOne: false
            referencedRelation: "eleves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_credit_famille_id_fkey"
            columns: ["famille_id"]
            isOneToOne: false
            referencedRelation: "familles"
            referencedColumns: ["id"]
          },
        ]
      }
      versements_credit: {
        Row: {
          canal: string
          created_at: string
          created_by: string | null
          date_versement: string
          id: string
          montant: number
          reference: string | null
          vente_credit_id: string
        }
        Insert: {
          canal?: string
          created_at?: string
          created_by?: string | null
          date_versement?: string
          id?: string
          montant: number
          reference?: string | null
          vente_credit_id: string
        }
        Update: {
          canal?: string
          created_at?: string
          created_by?: string | null
          date_versement?: string
          id?: string
          montant?: number
          reference?: string | null
          vente_credit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "versements_credit_vente_credit_id_fkey"
            columns: ["vente_credit_id"]
            isOneToOne: false
            referencedRelation: "ventes_credit"
            referencedColumns: ["id"]
          },
        ]
      }
      zones_transport: {
        Row: {
          chauffeur_bus: string | null
          created_at: string
          id: string
          nom: string
          prix_mensuel: number
          quartiers: string[] | null
          telephone_chauffeur: string | null
          updated_at: string
        }
        Insert: {
          chauffeur_bus?: string | null
          created_at?: string
          id?: string
          nom: string
          prix_mensuel?: number
          quartiers?: string[] | null
          telephone_chauffeur?: string | null
          updated_at?: string
        }
        Update: {
          chauffeur_bus?: string | null
          created_at?: string
          id?: string
          nom?: string
          prix_mensuel?: number
          quartiers?: string[] | null
          telephone_chauffeur?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      debit_famille_wallet: {
        Args: {
          _description?: string
          _eleve_id: string
          _famille_id: string
          _montant: number
          _type_paiement: string
        }
        Returns: Json
      }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_maternelle_or_primary_class: {
        Args: { _classe_id: string }
        Returns: boolean
      }
      is_primary_class: { Args: { _classe_id: string }; Returns: boolean }
      is_primary_niveau: { Args: { _niveau_id: string }; Returns: boolean }
      notify_credit_reminders: { Args: never; Returns: undefined }
      verify_password: {
        Args: { _hash: string; _password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "secretaire"
        | "service_info"
        | "comptable"
        | "boutique"
        | "cantine"
        | "librairie"
        | "coordinateur"
        | "superviseur"
        | "robotique"
      categorie_employe:
        | "enseignant"
        | "administration"
        | "service"
        | "direction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "secretaire",
        "service_info",
        "comptable",
        "boutique",
        "cantine",
        "librairie",
        "coordinateur",
        "superviseur",
        "robotique",
      ],
      categorie_employe: [
        "enseignant",
        "administration",
        "service",
        "direction",
      ],
    },
  },
} as const
