

# EduGestion Pro — Plan d'implémentation

## Vue d'ensemble
Application ERP scolaire complète gérant les cycles Crèche, Maternelle, Primaire, Collège et Lycée avec 4 rôles (Admin, Secrétaire, Service Info, Comptable). Backend sur Lovable Cloud (Supabase).

---

## 1. Authentification & Rôles
- Login sécurisé avec email/mot de passe
- 4 rôles : Admin (accès total), Secrétaire (inscriptions/familles), Service Info (notes/bulletins), Comptable (finances)
- Table de rôles séparée avec RLS pour chaque rôle
- Dashboard personnalisé selon le rôle de l'utilisateur connecté

## 2. Configuration & Paramétrage (Admin)
- Gestion des cycles (Crèche → Lycée), niveaux et classes
- Configuration des tarifs : scolarité par cycle/niveau, transport par zones, uniformes (Tenue scolaire, Sport, Polo Lacoste, Karaté), fournitures
- Paramétrage des réductions fratrie (ex: -10% 2ème enfant, -20% suivants)
- Gestion des périodes scolaires (5 périodes : Octobre à Juin + Rattrapage)
- Check-list d'inscription paramétrable (Livret scolaire, Paquet de Rames, Marqueurs)

## 3. Gestion des Inscriptions & Familles
- Inscription individuelle ou familiale (plusieurs enfants liés)
- Formulaire complet : informations élève, parents/tuteurs, photo, documents
- Calcul automatique des frais avec réduction fratrie dégressive
- Check-list obligatoire avant validation de l'inscription
- Options additionnelles : Transport (zone), Fournitures, Uniformes
- Génération de badge avec QR Code unique (photo + infos élève)

## 4. Comptabilité Analytique par Service
- **Services séparés** : Scolarité, Transport, Boutique/Uniformes, Cantine
- Enregistrement des recettes par service avec ventilation automatique
- Enregistrement des dépenses par service (ex: carburant pour Transport)
- Paiements multi-canaux : Espèces, Orange Money, MTN MoMo (simulation webhook)
- Suivi des soldes élèves (scolarité, cantine, transport)
- Tableau de bord financier avec **Indice de Rentabilité** mensuel (Recettes/Dépenses) par service
- Graphiques de suivi avec Recharts

## 5. Module Académique & Notes
- Saisie des notes par période (5 périodes) — interface dédiée au Service Info
- Configuration des matières par cycle/niveau avec coefficients
- Calcul automatique des moyennes par matière, par période et annuelle
- Seuils de validation : 6/10 (Primaire), 12/20 (Secondaire)
- Génération automatique des rattrapages (Juillet/Août/Septembre) pour les élèves en échec
- Bulletins scolaires générables et imprimables (PDF)

## 6. Orientation Intelligente & Tableaux d'Honneur
- Regroupement des matières par pôles : Scientifique, Littéraire, Social
- **Graphique Radar (Spider Chart)** sur le profil élève montrant les performances par pôle
- Suggestion d'orientation automatique basée sur les points forts
- Identification du **Major de classe** après chaque période
- Génération de certificat d'honneur imprimable

## 7. Bibliothèque Numérique & Livret Unique
- Dossier numérique par élève : historique complet (bulletins, certificats, radars)
- Navigation par Cycle > Niveau > Classe
- Interface type bibliothèque avec recherche et filtres
- Conservation de l'historique durant tout le parcours de l'élève dans l'école

## 8. Cantine & Scan QR Code
- Gestion du solde cantine par élève (rechargement via paiement)
- Interface de scan QR Code pour débiter le repas
- Notification instantanée aux parents (repas pris + solde restant) — simulée
- Historique des repas par élève

## 9. Réinscription & CRM
- Bascule automatique en fin d'année : statut "À réinscrire"
- Réinscription simplifiée (conservation des données existantes, mise à jour du niveau)
- Centre de notifications avec relances :
  - Relance réinscription (parents n'ayant pas réinscrit)
  - Alertes retard de paiement
- Simulation SMS/Push (intégration réelle ultérieure)

## 10. Design & Navigation
- Interface professionnelle avec sidebar de navigation par module
- Mobile-responsive avec Tailwind CSS et Shadcn UI
- Icônes Lucide React
- Thème aux couleurs institutionnelles (personnalisable)
- Tableaux de données avec tri, filtres et pagination

