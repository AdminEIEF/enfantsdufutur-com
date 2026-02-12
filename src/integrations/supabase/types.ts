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
          id: string
          libelle: string
          montant: number
          service: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_depense?: string
          id?: string
          libelle: string
          montant: number
          service: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_depense?: string
          id?: string
          libelle?: string
          montant?: number
          service?: string
        }
        Relationships: []
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
          famille_id: string | null
          id: string
          matricule: string | null
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
          famille_id?: string | null
          id?: string
          matricule?: string | null
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
          famille_id?: string | null
          id?: string
          matricule?: string | null
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
          created_at: string
          email_parent: string | null
          id: string
          nom_famille: string
          telephone_mere: string | null
          telephone_pere: string | null
          updated_at: string
        }
        Insert: {
          adresse?: string | null
          created_at?: string
          email_parent?: string | null
          id?: string
          nom_famille: string
          telephone_mere?: string | null
          telephone_pere?: string | null
          updated_at?: string
        }
        Update: {
          adresse?: string | null
          created_at?: string
          email_parent?: string | null
          id?: string
          nom_famille?: string
          telephone_mere?: string | null
          telephone_pere?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      matieres: {
        Row: {
          coefficient: number
          created_at: string
          cycle_id: string | null
          id: string
          nom: string
          pole: string | null
        }
        Insert: {
          coefficient?: number
          created_at?: string
          cycle_id?: string | null
          id?: string
          nom: string
          pole?: string | null
        }
        Update: {
          coefficient?: number
          created_at?: string
          cycle_id?: string | null
          id?: string
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
        ]
      }
      niveaux: {
        Row: {
          created_at: string
          cycle_id: string
          frais_scolarite: number
          id: string
          nom: string
          ordre: number
        }
        Insert: {
          created_at?: string
          cycle_id: string
          frais_scolarite?: number
          id?: string
          nom: string
          ordre?: number
        }
        Update: {
          created_at?: string
          cycle_id?: string
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
      paiements: {
        Row: {
          canal: string
          created_at: string
          created_by: string | null
          date_paiement: string
          eleve_id: string
          id: string
          mois_concerne: string | null
          montant: number
          reference: string | null
          type_paiement: string
        }
        Insert: {
          canal?: string
          created_at?: string
          created_by?: string | null
          date_paiement?: string
          eleve_id: string
          id?: string
          mois_concerne?: string | null
          montant: number
          reference?: string | null
          type_paiement: string
        }
        Update: {
          canal?: string
          created_at?: string
          created_by?: string | null
          date_paiement?: string
          eleve_id?: string
          id?: string
          mois_concerne?: string | null
          montant?: number
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
          date_repas: string
          eleve_id: string
          id: string
          montant_debite: number
        }
        Insert: {
          date_repas?: string
          eleve_id: string
          id?: string
          montant_debite: number
        }
        Update: {
          date_repas?: string
          eleve_id?: string
          id?: string
          montant_debite?: number
        }
        Relationships: [
          {
            foreignKeyName: "repas_cantine_eleve_id_fkey"
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
      zones_transport: {
        Row: {
          chauffeur_bus: string | null
          created_at: string
          id: string
          nom: string
          prix_mensuel: number
          quartiers: string[] | null
          updated_at: string
        }
        Insert: {
          chauffeur_bus?: string | null
          created_at?: string
          id?: string
          nom: string
          prix_mensuel?: number
          quartiers?: string[] | null
          updated_at?: string
        }
        Update: {
          chauffeur_bus?: string | null
          created_at?: string
          id?: string
          nom?: string
          prix_mensuel?: number
          quartiers?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      app_role: "admin" | "secretaire" | "service_info" | "comptable"
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
      app_role: ["admin", "secretaire", "service_info", "comptable"],
    },
  },
} as const
