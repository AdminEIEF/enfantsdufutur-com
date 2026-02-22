import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, CheckCircle2, Users, MapPin, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useZonesTransport } from '@/pages/Configuration';
import MandatairesForm, { Mandataire, createEmptyMandataires, uploadMandatairePhotos } from '@/components/MandatairesForm';

// ─── Types ───────────────────────────────────────────────
interface ChildForm {
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  classeId: string;
  photoEleve: File | null;
  photoElevePreview: string | null;
  zoneTransportId: string;
  adresse: string;
  uniformeScolaire: boolean;
  uniformeSport: boolean;
  uniformePolo: boolean;
  uniformeKarate: boolean;
  uniformeScout: boolean;
  optionCantine: boolean;
  optionFournitures: boolean;
  optionAssurance: boolean;
  selectedArticles: Record<string, boolean>;
  checkLivret: boolean;
  checkRames: boolean;
  checkMarqueurs: boolean;
  checkPhoto: boolean;
  mandataires: Mandataire[];
  typeInscription: 'inscription' | 'reinscription';
  expanded: boolean;
}

function createEmptyChild(): ChildForm {
  return {
    nom: '', prenom: '', sexe: '', dateNaissance: '', classeId: '',
    photoEleve: null, photoElevePreview: null,
    zoneTransportId: '', adresse: '',
    uniformeScolaire: false, uniformeSport: false,
    uniformePolo: false, uniformeKarate: false, uniformeScout: false, optionCantine: false,
    optionFournitures: false, optionAssurance: false, selectedArticles: {},
    checkLivret: false, checkRames: false, checkMarqueurs: false, checkPhoto: false,
    mandataires: createEmptyMandataires(),
    typeInscription: 'inscription', expanded: true,
  };
}

function useBoutiquePrices() {
  return useQuery({
    queryKey: ['boutique-uniform-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('boutique_articles')
        .select('id, nom, categorie, prix, taille, stock')
        .order('categorie');
      if (error) throw error;
      return data as any[];
    },
  });
}

function getBoutiquePrice(articles: any[], categorie: string) {
  const match = articles.find((a: any) => a.categorie === categorie);
  return match ? Number(match.prix) : 0;
}

function getBoutiquePriceByCycle(articles: any[], categorie: string, isPrimaire: boolean) {
  const matches = articles.filter((a: any) => a.categorie === categorie);
  if (matches.length <= 1) return matches[0] ? Number(matches[0].prix) : 0;
  const match = isPrimaire
    ? matches.find((a: any) => /primaire|maternelle|enfant|crèche|creche/i.test(a.nom + ' ' + (a.taille || '')))
    : matches.find((a: any) => /coll[eè]ge|lyc[eé]e/i.test(a.nom + ' ' + (a.taille || '')));
  return match ? Number(match.prix) : Number(matches[0].prix);
}

function useArticlesForLevel(niveauId: string | null) {
  return useQuery({
    queryKey: ['articles-for-level', niveauId],
    queryFn: async () => {
      if (!niveauId) return [];
      const { data, error } = await supabase
        .from('articles' as any)
        .select('*')
        .or(`niveau_id.eq.${niveauId},niveau_id.is.null`)
        .order('categorie').order('nom');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!niveauId,
  });
}

// ─── Per-child articles hook wrapper ─────────────────────
function ChildArticles({ niveauId, child, index, onUpdate }: {
  niveauId: string | null;
  child: ChildForm;
  index: number;
  onUpdate: (idx: number, patch: Partial<ChildForm>) => void;
}) {
  const { data: articles = [] } = useArticlesForLevel(niveauId);
  const total = useMemo(() =>
    articles.filter((a: any) => child.selectedArticles[a.id]).reduce((s: number, a: any) => s + Number(a.prix), 0),
    [articles, child.selectedArticles]
  );

  if (!niveauId || articles.length === 0) return null;

  return (
    <div className="space-y-2 mt-3">
      <p className="text-xs font-semibold">📚 Kit Fournitures & Romans</p>
      {['fourniture', 'manuel', 'roman'].map(cat => {
        const items = articles.filter((a: any) => a.categorie === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-xs font-medium capitalize mb-1">
              {cat === 'fourniture' ? '📦 Fournitures' : cat === 'manuel' ? '📖 Manuels' : '📚 Romans'}
            </p>
            <div className="space-y-1">
              {items.map((a: any) => (
                <div key={a.id} className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-xs ${a.stock <= 0 ? 'opacity-50' : ''} ${child.selectedArticles[a.id] ? 'bg-primary/10 border border-primary/30' : 'bg-muted'}`}>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!!child.selectedArticles[a.id]}
                      disabled={a.stock <= 0}
                      onCheckedChange={(v) => onUpdate(index, {
                        selectedArticles: { ...child.selectedArticles, [a.id]: !!v }
                      })}
                    />
                    <span>{a.nom}</span>
                    {a.stock <= 0 && <Badge variant="destructive" className="text-[10px] px-1">Épuisé</Badge>}
                  </div>
                  <span className="font-medium text-muted-foreground">{Number(a.prix).toLocaleString()} GNF</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {total > 0 && (
        <p className="text-right text-xs font-bold text-primary">Sous-total articles : {total.toLocaleString()} GNF</p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
interface Props {
  classes: any[];
  familles: any[];
  tarifs: any[];
  existingEleves: any[];
  onSuccess: () => void;
  /** If true, start with 1 child and show parent fields for auto-family creation */
  mode?: 'individuel' | 'famille';
}

export default function InscriptionFamilleForm({ classes, familles, tarifs, existingEleves, onSuccess, mode = 'famille' }: Props) {
  const [familleId, setFamilleId] = useState('');
  const [nomPrenomPere, setNomPrenomPere] = useState('');
  const [nomPrenomMere, setNomPrenomMere] = useState('');
  const [telephonePere, setTelephonePere] = useState('');
  const [telephoneMere, setTelephoneMere] = useState('');
  const [emailParent, setEmailParent] = useState('');
  const [adresseParent, setAdresseParent] = useState('');
  const [children, setChildren] = useState<ChildForm[]>([createEmptyChild()]);
  const queryClient = useQueryClient();
  const { data: zones = [] } = useZonesTransport();
  const { data: boutiqueArticles = [] } = useBoutiquePrices();

  // Fetch tranches config
  const { data: allTranchesConfig = {} } = useQuery({
    queryKey: ['parametres-tranches-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'tranches_paiement_v2').maybeSingle();
      if (error) throw error;
      if (data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)) {
        return data.valeur as Record<string, Array<{ label: string; mois: string[]; montant: number }>>;
      }
      return {} as Record<string, Array<{ label: string; mois: string[]; montant: number }>>;
    },
  });

  const needsNewFamily = !familleId;

  const addChild = () => setChildren(prev => [...prev, createEmptyChild()]);
  const removeChild = (idx: number) => {
    if (children.length <= 1) return;
    setChildren(prev => prev.filter((_, i) => i !== idx));
  };

  const updateChild = (idx: number, patch: Partial<ChildForm>) => {
    setChildren(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  // Existing siblings in the selected family
  const existingSiblings = useMemo(() => {
    if (!familleId) return [];
    return existingEleves.filter((e: any) => e.famille_id === familleId);
  }, [familleId, existingEleves]);

  const totalEnfantsFamille = existingSiblings.length + children.length;
  const reduction = totalEnfantsFamille >= 3 ? 0.10 : 0;

  // Suggest zone based on address
  const suggestZone = (adresse: string) => {
    if (!adresse || !zones?.length) return null;
    const adresseLower = adresse.toLowerCase();
    for (const z of zones) {
      const quartiers = (z.quartiers ?? []) as string[];
      if (quartiers.some((q: string) => adresseLower.includes(q.toLowerCase()))) {
        return z.id;
      }
    }
    return null;
  };

  // Helper: get fees for a single child
  const getChildFees = (child: ChildForm) => {
    const cl = classes.find((c: any) => c.id === child.classeId);
    const fraisScolarite = cl?.niveaux?.frais_scolarite || 0;
    const fraisApresReduction = fraisScolarite * (1 - reduction);
    const zone = zones.find((z: any) => z.id === child.zoneTransportId);
    const fraisTransport = zone ? Number(zone.prix_mensuel) : 0;
    const cycleName = cl?.niveaux?.cycles?.nom || '';
    const isPrimaireFees = ['Crèche', 'Maternelle', 'Primaire'].includes(cycleName);

    // Prices from boutique_articles
    const prixTenueScolaire = getBoutiquePriceByCycle(boutiqueArticles, 'tenue_scolaire', isPrimaireFees);
    const prixTenueSport = getBoutiquePrice(boutiqueArticles, 'tenue_sport');
    const prixPoloLacoste = getBoutiquePrice(boutiqueArticles, 'polo_lacoste');
    const prixKarate = getBoutiquePrice(boutiqueArticles, 'tenue_karate');
    const prixScout = getBoutiquePrice(boutiqueArticles, 'tenue_scout');

    const fraisUniformes =
      (child.uniformeScolaire ? prixTenueScolaire : 0) +
      (child.uniformeSport ? prixTenueSport : 0) +
      (child.uniformePolo ? prixPoloLacoste : 0) +
      (child.uniformeKarate ? prixKarate : 0) +
      (child.uniformeScout ? prixScout : 0);
    const fraisFournitures = child.optionFournitures ? (tarifs.find((t: any) => t.categorie === 'fournitures')?.montant || 0) : 0;
    const fraisAssurance = child.optionAssurance ? (cl?.niveaux?.frais_assurance || 0) : 0;
    const fraisInscription = child.typeInscription === 'inscription' 
      ? (cl?.niveaux?.frais_inscription ?? 100000) 
      : (cl?.niveaux?.frais_reinscription ?? 150000);
    const fraisDossier = cl?.niveaux?.frais_dossier ?? 0;

    return {
      fraisInscription,
      fraisDossier,
      fraisScolariteMensuel: fraisApresReduction,
      fraisScolariteAnnuel: fraisApresReduction,
      fraisTransport,
      fraisUniformes,
      fraisFournitures,
      fraisAssurance,
      totalImmediat: fraisInscription + fraisDossier + fraisUniformes + fraisFournitures + fraisAssurance,
    };
  };

  const childrenFees = children.map(getChildFees);
  const grandTotalImmediat = childrenFees.reduce((s, f) => s + f.totalImmediat, 0);
  const grandTotalScolariteAnnuel = childrenFees.reduce((s, f) => s + f.fraisScolariteAnnuel, 0);

  const generateMatricule = async () => {
    const now = new Date();
    const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await supabase.from('eleves').select('*', { count: 'exact', head: true }).like('matricule', `${prefix}%`);
    return `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const inscription = useMutation({
    mutationFn: async () => {
      // Validate children
      for (const child of children) {
        if (!child.nom.trim() || !child.prenom.trim() || !child.classeId) {
          throw new Error(`Nom, prénom et classe sont obligatoires pour chaque enfant`);
        }
      }

      // Validate parent info if no family selected
      if (needsNewFamily) {
        if (!nomPrenomPere.trim() && !nomPrenomMere.trim()) {
          throw new Error('Le nom du père ou de la mère est obligatoire');
        }
        if (!telephonePere.trim() && !telephoneMere.trim()) {
          throw new Error('Au moins un numéro de téléphone parent est obligatoire');
        }
      }

      // Auto-create family if needed
      let effectiveFamilleId = familleId || null;
      let generatedCode: string | null = null;

      if (needsNewFamily) {
        generatedCode = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const nomFamille = children[0].nom.trim().toUpperCase();
        
        const { data: newFamille, error: famErr } = await supabase.from('familles').insert({
          nom_famille: nomFamille,
          telephone_pere: telephonePere.trim() || null,
          telephone_mere: telephoneMere.trim() || null,
          email_parent: emailParent.trim() || null,
          adresse: adresseParent.trim() || null,
          code_acces: generatedCode,
        } as any).select('id').single();
        if (famErr) throw famErr;
        effectiveFamilleId = newFamille.id;
      }

      // Generate default student password helper
      const genPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let pwd = '';
        for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
        return pwd;
      };

      // Insert each child
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const matricule = await generateMatricule();
        const zone = zones.find((z: any) => z.id === child.zoneTransportId);
        const cl = classes.find((c: any) => c.id === child.classeId);
        const cycleName = cl?.niveaux?.cycles?.nom?.toLowerCase() || '';
        const isCrecheMaternelle = cycleName.includes('crèche') || cycleName.includes('creche') || cycleName.includes('maternelle');
        const isPrimaire = ['crèche', 'maternelle', 'primaire'].includes(cycleName.toLowerCase());

        // Upload photo
        let photoUrl: string | null = null;
        if (child.photoEleve) {
          const ext = child.photoEleve.name.split('.').pop() || 'jpg';
          const path = `eleves/${matricule}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('photos').upload(path, child.photoEleve, { upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
            photoUrl = urlData.publicUrl;
          }
        }

        const { data: insertedEleve, error } = await supabase.from('eleves').insert({
          nom: child.nom.trim(), prenom: child.prenom.trim(),
          sexe: child.sexe || null, date_naissance: child.dateNaissance || null,
          classe_id: child.classeId, famille_id: effectiveFamilleId,
          matricule, qr_code: matricule,
          transport_zone: zone?.nom || null,
          zone_transport_id: child.zoneTransportId || null,
          checklist_livret: child.checkLivret, checklist_rames: child.checkRames,
          checklist_marqueurs: child.checkMarqueurs, checklist_photo: child.checkPhoto,
          uniforme_scolaire: child.uniformeScolaire, uniforme_sport: child.uniformeSport,
          uniforme_polo_lacoste: child.uniformePolo, uniforme_karate: child.uniformeKarate,
          uniforme_scout: child.uniformeScout,
          option_cantine: child.optionCantine, option_fournitures: child.optionFournitures,
          nom_prenom_pere: nomPrenomPere || null, nom_prenom_mere: nomPrenomMere || null,
          statut: 'inscrit', photo_url: photoUrl,
          mot_de_passe_eleve: genPassword(),
        } as any).select('id').single();
        if (error) throw error;

        // Mandataires for crèche/maternelle
        if (isCrecheMaternelle && insertedEleve) {
          const uploaded = await uploadMandatairePhotos(child.mandataires, insertedEleve.id);
          const valid = uploaded.filter(m => m.nom.trim() && m.prenom.trim()).map((m, idx) => ({
            eleve_id: insertedEleve.id, nom: m.nom.trim(), prenom: m.prenom.trim(),
            lien_parente: m.lien_parente, photo_url: m.photo_url, ordre: idx + 1,
          }));
          if (valid.length > 0) {
            await supabase.from('mandataires').insert(valid as any);
          }
        }

        // Payments
        if (insertedEleve) {
          const fees = childrenFees[i];
          const paiements: any[] = [
            { eleve_id: insertedEleve.id, montant: fees.fraisInscription + fees.fraisDossier, type_paiement: child.typeInscription, canal: 'especes' },
          ];
          if (fees.fraisUniformes > 0) {
            paiements.push({ eleve_id: insertedEleve.id, montant: fees.fraisUniformes, type_paiement: 'boutique', canal: 'especes' });
          }
          if (fees.fraisFournitures > 0) {
            paiements.push({ eleve_id: insertedEleve.id, montant: fees.fraisFournitures, type_paiement: 'boutique', canal: 'especes' });
          }
          if (fees.fraisAssurance > 0) {
            paiements.push({ eleve_id: insertedEleve.id, montant: fees.fraisAssurance, type_paiement: 'inscription', canal: 'especes', mois_concerne: 'Assurance scolaire' });
          }
          if (paiements.length > 0) {
            await supabase.from('paiements').insert(paiements as any);
          }

          // Commandes articles (uniforms from boutique_articles + selected articles)
          const commandesArticles: any[] = [];
          const clCmd = classes.find((c: any) => c.id === child.classeId);
          const cycleNameCmd = clCmd?.niveaux?.cycles?.nom || '';
          const isPrimaireCmd = ['Crèche', 'Maternelle', 'Primaire'].includes(cycleNameCmd);
          const prixTenueScolaire = getBoutiquePriceByCycle(boutiqueArticles, 'tenue_scolaire', isPrimaireCmd);
          const prixTenueSport = getBoutiquePrice(boutiqueArticles, 'tenue_sport');
          const prixPoloLacoste = getBoutiquePrice(boutiqueArticles, 'polo_lacoste');
          const prixKarate = getBoutiquePrice(boutiqueArticles, 'tenue_karate');
          const prixScout = getBoutiquePrice(boutiqueArticles, 'tenue_scout');

          if (child.uniformeScolaire) {
            commandesArticles.push({
              eleve_id: insertedEleve.id, article_type: 'boutique',
              article_nom: 'Tenue Scolaire',
              quantite: 1, prix_unitaire: prixTenueScolaire, statut: 'paye', source: 'inscription',
            });
          }
          if (child.uniformeSport) {
            commandesArticles.push({
              eleve_id: insertedEleve.id, article_type: 'boutique',
              article_nom: 'Tenue de Sport', quantite: 1, prix_unitaire: prixTenueSport,
              statut: 'paye', source: 'inscription',
            });
          }
          if (child.uniformePolo) {
            commandesArticles.push({
              eleve_id: insertedEleve.id, article_type: 'boutique',
              article_nom: 'Polo Lacoste', quantite: 1, prix_unitaire: prixPoloLacoste,
              statut: 'paye', source: 'inscription',
            });
          }
          if (child.uniformeKarate) {
            commandesArticles.push({
              eleve_id: insertedEleve.id, article_type: 'boutique',
              article_nom: 'Tenue de Karaté', quantite: 1, prix_unitaire: prixKarate,
              statut: 'paye', source: 'inscription',
            });
          }
          if (child.uniformeScout) {
            commandesArticles.push({
              eleve_id: insertedEleve.id, article_type: 'boutique',
              article_nom: 'Tenue de Scout', quantite: 1, prix_unitaire: prixScout,
              statut: 'paye', source: 'inscription',
            });
          }

          if (commandesArticles.length > 0) {
            await supabase.from('commandes_articles' as any).insert(commandesArticles);
          }
        }
      }

      // Parent notification for auto-created family
      if (needsNewFamily && effectiveFamilleId && generatedCode) {
        const firstChild = children[0];
        await supabase.from('parent_notifications').insert({
          famille_id: effectiveFamilleId,
          titre: '🎉 Bienvenue sur l\'Espace Parent',
          message: `L'espace parent pour le suivi de ${children.map(c => c.prenom).join(', ')} est actif.\n\nVotre identifiant : ${telephonePere.trim() || telephoneMere.trim()}\nVotre code d'accès : ${generatedCode}\n\nConnectez-vous sur l'espace parent pour suivre la scolarité de vos enfants.`,
          type: 'info',
        } as any);
      }

      return { generatedCode, effectiveFamilleId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      queryClient.invalidateQueries({ queryKey: ['eleves-full'] });
      queryClient.invalidateQueries({ queryKey: ['familles'] });
      queryClient.invalidateQueries({ queryKey: ['familles-with-children'] });

      if (result?.generatedCode) {
        toast({
          title: `Inscription réussie — ${children.length} enfant(s)`,
          description: `Code parent : ${result.generatedCode} (Tél: ${telephonePere.trim() || telephoneMere.trim()})`,
        });
      } else {
        toast({ title: 'Inscription réussie', description: `${children.length} enfant(s) inscrit(s) avec succès.` });
      }
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="grid gap-4">
      {/* ─── Famille / Parent ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Famille & Parents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Famille existante (fratrie)</Label>
            <Select value={familleId || '__none__'} onValueChange={(v) => setFamilleId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une famille" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">➕ Nouvelle famille (auto-créée)</SelectItem>
                {familles.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.nom_famille} {f.telephone_pere || f.telephone_mere ? `— ${f.telephone_pere || f.telephone_mere}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {familleId && existingSiblings.length > 0 && (
            <div className="p-2 rounded bg-muted text-xs">
              <p className="font-medium mb-1">Enfants déjà inscrits :</p>
              {existingSiblings.map((e: any) => (
                <Badge key={e.id} variant="outline" className="text-xs mr-1 mb-1">{e.prenom} {e.nom} — {e.classes?.nom || '?'}</Badge>
              ))}
            </div>
          )}

          {/* Parent info — always visible when no family, collapsed when family selected */}
          {needsNewFamily && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nom & Prénom du père *</Label>
                  <Input value={nomPrenomPere} onChange={e => setNomPrenomPere(e.target.value)} placeholder="Ex: Kouamé Jean-Pierre" />
                </div>
                <div>
                  <Label>Nom & Prénom de la mère *</Label>
                  <Input value={nomPrenomMere} onChange={e => setNomPrenomMere(e.target.value)} placeholder="Ex: Bamba Fatou" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Téléphone père *</Label>
                  <Input value={telephonePere} onChange={e => setTelephonePere(e.target.value)} placeholder="Ex: +224 620 00 00 00" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Téléphone mère</Label>
                  <Input value={telephoneMere} onChange={e => setTelephoneMere(e.target.value)} placeholder="Ex: +224 620 00 00 00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email parent (optionnel)</Label>
                  <Input type="email" value={emailParent} onChange={e => setEmailParent(e.target.value)} placeholder="parent@email.com" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Adresse</Label>
                  <Input value={adresseParent} onChange={e => setAdresseParent(e.target.value)} placeholder="Ex: Quartier Riviera" />
                </div>
              </div>
              <div className="p-2 rounded bg-accent/10 border border-accent/30 text-xs text-accent-foreground">
                ℹ️ Un <strong>Espace Parent</strong> sera automatiquement créé avec un code d'accès unique (FAM-XXXX).
              </div>
            </>
          )}

          {!needsNewFamily && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom père</Label>
                <Input value={nomPrenomPere} onChange={e => setNomPrenomPere(e.target.value)} placeholder="Optionnel si déjà dans la famille" />
              </div>
              <div>
                <Label>Nom mère</Label>
                <Input value={nomPrenomMere} onChange={e => setNomPrenomMere(e.target.value)} placeholder="Optionnel si déjà dans la famille" />
              </div>
            </div>
          )}

          {reduction > 0 && (
            <div className="p-2 rounded bg-accent/10 border border-accent/30 text-xs text-accent font-medium">
              🎉 Réduction fratrie de {reduction * 100}% appliquée sur la scolarité ({totalEnfantsFamille} enfants)
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Children ─── */}
      {children.map((child, idx) => {
        const cl = classes.find((c: any) => c.id === child.classeId);
        const niveauId = cl?.niveau_id || null;
        const cycleName = cl?.niveaux?.cycles?.nom || '';
        const isPrimaire = ['Crèche', 'Maternelle', 'Primaire'].includes(cycleName);
        const isCrecheMaternelle = cycleName.toLowerCase().includes('crèche') || cycleName.toLowerCase().includes('creche') || cycleName.toLowerCase().includes('maternelle');
        const fees = childrenFees[idx];
        const zone = zones.find((z: any) => z.id === child.zoneTransportId);
        const suggestedZoneId = suggestZone(child.adresse || adresseParent);

        const prixTenueScolaire = getBoutiquePriceByCycle(boutiqueArticles, 'tenue_scolaire', isPrimaire);
        const prixTenueSport = getBoutiquePrice(boutiqueArticles, 'tenue_sport');
        const prixPoloLacoste = getBoutiquePrice(boutiqueArticles, 'polo_lacoste');
        const prixKarate = getBoutiquePrice(boutiqueArticles, 'tenue_karate');
        const prixScout = getBoutiquePrice(boutiqueArticles, 'tenue_scout');

        // Scolarite tranches
        const fraisScolarite = cl?.niveaux?.frais_scolarite || 0;
        const totalAnnuel = fraisScolarite * (1 - reduction);
        const tranchesConfig = niveauId && allTranchesConfig[niveauId] ? allTranchesConfig[niveauId] as Array<{ label: string; mois: string[]; montant: number }> : null;

        return (
          <Card key={idx} className="border-l-4 border-l-primary/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  👦 Enfant {idx + 1}
                  {child.prenom && child.nom && <span className="text-sm font-normal text-muted-foreground">— {child.prenom} {child.nom}</span>}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => updateChild(idx, { expanded: !child.expanded })}>
                    {child.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  {children.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeChild(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {child.expanded && (
              <CardContent className="space-y-4">
                {/* Identity */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nom *</Label><Input value={child.nom} onChange={e => updateChild(idx, { nom: e.target.value })} /></div>
                  <div><Label>Prénom *</Label><Input value={child.prenom} onChange={e => updateChild(idx, { prenom: e.target.value })} /></div>
                  <div>
                    <Label>Sexe</Label>
                    <Select value={child.sexe} onValueChange={(v) => updateChild(idx, { sexe: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date de naissance</Label><Input type="date" value={child.dateNaissance} onChange={e => updateChild(idx, { dateNaissance: e.target.value })} /></div>
                </div>

                {/* Photo */}
                <div className="flex items-center gap-3">
                  {child.photoElevePreview ? (
                    <img src={child.photoElevePreview} alt="Photo" className="w-12 h-12 rounded-lg object-cover border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/40 text-lg">👤</div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) updateChild(idx, { photoEleve: f, photoElevePreview: URL.createObjectURL(f) });
                    }} />
                    <span className="text-xs text-primary hover:underline">{child.photoElevePreview ? 'Changer' : 'Photo'}</span>
                  </label>
                </div>

                {/* Type + Classe */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={child.typeInscription} onValueChange={(v: 'inscription' | 'reinscription') => updateChild(idx, { typeInscription: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inscription">Inscription — {(cl?.niveaux?.frais_inscription ?? 100000).toLocaleString()} GNF</SelectItem>
                        <SelectItem value="reinscription">Réinscription — {(cl?.niveaux?.frais_reinscription ?? 150000).toLocaleString()} GNF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Classe *</Label>
                    <Select value={child.classeId} onValueChange={(v) => updateChild(idx, { classeId: v, selectedArticles: {} })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Check-list documents */}
                <div>
                  <p className="text-xs font-semibold mb-1.5">Check-list documents</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-2"><Checkbox checked={child.checkLivret} onCheckedChange={(v) => updateChild(idx, { checkLivret: !!v })} /><Label className="text-xs">Livret scolaire</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={child.checkRames} onCheckedChange={(v) => updateChild(idx, { checkRames: !!v })} /><Label className="text-xs">Paquet de Rames</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={child.checkMarqueurs} onCheckedChange={(v) => updateChild(idx, { checkMarqueurs: !!v })} /><Label className="text-xs">Marqueurs</Label></div>
                    <div className="flex items-center gap-2"><Checkbox checked={child.checkPhoto} onCheckedChange={(v) => updateChild(idx, { checkPhoto: !!v })} /><Label className="text-xs">Photo d'identité</Label></div>
                  </div>
                </div>

                <Separator />

                {/* ─── Options & Services (per child) ─── */}
                <div>
                  <p className="text-sm font-semibold mb-2">🎯 Options & Services — {child.prenom || `Enfant ${idx + 1}`}</p>

                  {/* Transport */}
                  <div className="mb-3">
                    <Label className="flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" /> Zone de transport</Label>
                    <Select value={child.zoneTransportId || '__none__'} onValueChange={(v) => updateChild(idx, { zoneTransportId: v === '__none__' ? '' : v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pas de transport" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Pas de transport</SelectItem>
                        {zones.map((z: any) => (
                          <SelectItem key={z.id} value={z.id}>{z.nom} — {Number(z.prix_mensuel).toLocaleString()} GNF/mois</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {zone && <p className="text-[10px] text-accent mt-0.5">💰 {Number(zone.prix_mensuel).toLocaleString()} GNF/mois</p>}
                    {suggestedZoneId && suggestedZoneId !== child.zoneTransportId && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary underline cursor-pointer"
                        onClick={() => updateChild(idx, { zoneTransportId: suggestedZoneId })}
                      >
                        💡 Zone suggérée : {zones.find((z: any) => z.id === suggestedZoneId)?.nom} — Cliquer pour appliquer
                      </button>
                    )}
                  </div>

                  {/* Uniformes (prix depuis la boutique) */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.uniformeScolaire} onCheckedChange={(v) => updateChild(idx, { uniformeScolaire: !!v })} />
                      <Label className="text-xs">Tenue scolaire {prixTenueScolaire > 0 && <span className="text-muted-foreground">— {prixTenueScolaire.toLocaleString()}</span>}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.uniformeSport} onCheckedChange={(v) => updateChild(idx, { uniformeSport: !!v })} />
                      <Label className="text-xs">Tenue sport {prixTenueSport > 0 && <span className="text-muted-foreground">— {prixTenueSport.toLocaleString()}</span>}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.uniformePolo} onCheckedChange={(v) => updateChild(idx, { uniformePolo: !!v })} />
                      <Label className="text-xs">Polo Lacoste {prixPoloLacoste > 0 && <span className="text-muted-foreground">— {prixPoloLacoste.toLocaleString()}</span>}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.uniformeKarate} onCheckedChange={(v) => updateChild(idx, { uniformeKarate: !!v })} />
                      <Label className="text-xs">Karaté {prixKarate > 0 && <span className="text-muted-foreground">— {prixKarate.toLocaleString()}</span>}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.uniformeScout} onCheckedChange={(v) => updateChild(idx, { uniformeScout: !!v })} />
                      <Label className="text-xs">Tenue Scout {prixScout > 0 && <span className="text-muted-foreground">— {prixScout.toLocaleString()}</span>}</Label>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.optionCantine} onCheckedChange={(v) => updateChild(idx, { optionCantine: !!v })} />
                      <Label className="text-xs">🍽️ Cantine</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.optionAssurance} onCheckedChange={(v) => updateChild(idx, { optionAssurance: !!v })} />
                      <Label className="text-xs">🛡️ Assurance {child.optionAssurance && fees.fraisAssurance > 0 && <span className="text-muted-foreground">— {fees.fraisAssurance.toLocaleString()} GNF</span>}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={child.optionFournitures} onCheckedChange={(v) => updateChild(idx, { optionFournitures: !!v })} />
                      <Label className="text-xs">📦 Fournitures scolaires</Label>
                    </div>
                  </div>
                </div>

                {/* Articles per level */}
                <ChildArticles niveauId={niveauId} child={child} index={idx} onUpdate={updateChild} />

                {/* Mandataires for crèche/maternelle */}
                {isCrecheMaternelle && (
                  <MandatairesForm mandataires={child.mandataires} onChange={(m) => updateChild(idx, { mandataires: m })} />
                )}

                {/* Per-child summary */}
                <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
                  <p className="font-semibold text-sm">📋 Résumé — {child.prenom || `Enfant ${idx + 1}`}</p>
                  <div className="flex justify-between"><span>{child.typeInscription === 'inscription' ? 'Inscription' : 'Réinscription'}</span><span>{fees.fraisInscription.toLocaleString()} GNF</span></div>
                  {fees.fraisDossier > 0 && <div className="flex justify-between"><span>Frais de dossier</span><span>{fees.fraisDossier.toLocaleString()} GNF</span></div>}
                  {fees.fraisUniformes > 0 && <div className="flex justify-between"><span>Uniformes</span><span>{fees.fraisUniformes.toLocaleString()} GNF</span></div>}
                  {fees.fraisFournitures > 0 && <div className="flex justify-between"><span>Fournitures</span><span>{fees.fraisFournitures.toLocaleString()} GNF</span></div>}
                  {fees.fraisAssurance > 0 && <div className="flex justify-between"><span>Assurance</span><span>{fees.fraisAssurance.toLocaleString()} GNF</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1"><span>Total immédiat</span><span>{fees.totalImmediat.toLocaleString()} GNF</span></div>
                  
                  {/* Tranches scolarité */}
                  {totalAnnuel > 0 && (
                    <div className="pt-2 border-t mt-1 space-y-1">
                      <p className="text-[10px] font-semibold text-primary">SCOLARITÉ ANNUELLE</p>
                      <div className="flex justify-between text-muted-foreground"><span>Total annuel</span><span>{totalAnnuel.toLocaleString()} GNF</span></div>
                      {tranchesConfig && tranchesConfig.map((t, ti) => (
                        <div key={ti} className="flex justify-between text-muted-foreground">
                          <span>{t.label}</span><span>{t.montant.toLocaleString()} GNF</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {fees.fraisTransport > 0 && (
                    <div className="flex justify-between text-muted-foreground"><span>Transport (mensuel)</span><span>{fees.fraisTransport.toLocaleString()} GNF/mois</span></div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Add child */}
      <Button variant="outline" onClick={addChild} className="w-full border-dashed">
        <Plus className="h-4 w-4 mr-2" /> Ajouter un enfant
      </Button>

      {/* ─── Grand Total Famille ─── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🧾 Récapitulatif {children.length > 1 ? 'Famille' : ''}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {children.map((child, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{child.prenom || `Enfant ${idx + 1}`} — frais immédiats</span>
              <span className="font-medium">{childrenFees[idx].totalImmediat.toLocaleString()} GNF</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>TOTAL À PAYER MAINTENANT</span>
            <span>{grandTotalImmediat.toLocaleString()} GNF</span>
          </div>
          {grandTotalScolariteAnnuel > 0 && (
            <div className="flex justify-between text-muted-foreground text-xs pt-1">
              <span>Total scolarité annuelle (via Paiements)</span>
              <span>{grandTotalScolariteAnnuel.toLocaleString()} GNF</span>
            </div>
          )}
          {reduction > 0 && (
            <p className="text-xs text-accent">✨ Réduction fratrie de {reduction * 100}% appliquée sur la scolarité</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            ℹ️ La scolarité et le transport se paient via <strong>Paiements</strong>. Le compte cantine se recharge individuellement.
          </p>
        </CardContent>
      </Card>

      <Button onClick={() => inscription.mutate()} disabled={inscription.isPending} className="w-full" size="lg">
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Valider l'inscription — {children.length} enfant(s)
      </Button>
    </div>
  );
}
