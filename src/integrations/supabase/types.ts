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
          photo_url: string | null
          prenom: string
          qr_code: string | null
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
          photo_url?: string | null
          prenom: string
          qr_code?: string | null
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
          photo_url?: string | null
          prenom?: string
          qr_code?: string | null
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
          created_at: string
          famille_id: string
          id: string
          lu: boolean
          message: string
          titre: string
          type: string
        }
        Insert: {
          created_at?: string
          famille_id: string
          id?: string
          lu?: boolean
          message: string
          titre: string
          type?: string
        }
        Update: {
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          prenom: string
          telephone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          telephone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      ],
    },
  },
} as const
