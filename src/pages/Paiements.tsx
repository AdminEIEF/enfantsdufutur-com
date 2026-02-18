import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Plus, Search, TrendingUp, Wallet, Smartphone, CheckCircle, Printer, Download, Upload, Users, Landmark, Calendar, FileImage, UtensilsCrossed } from 'lucide-react';
import CantineDirectePanel from '@/components/CantineDirectePanel';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { generateRecuPDF } from '@/lib/generateRecuPDF';
import { generateRecuGeneriquePDF } from '@/lib/generateRecuGeneriquePDF';
import { generateRecuFamillePDF } from '@/lib/generateRecuFamillePDF';
import { exportToExcel, readExcelFile } from '@/lib/excelUtils';

const CANAUX = [
  { value: 'especes', label: 'Espèces', icon: Wallet },
  { value: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { value: 'mtn_momo', label: 'MTN MoMo', icon: Smartphone },
  { value: 'banque', label: 'Banque', icon: Landmark },
];

const DEFAULT_BANQUES = [
  'Ecobank', 'Société Générale (SGBG)', 'Vistabank', 'UBA', 'Orabank', 'FBNBank', 'Coris Bank',
];

function useBanquesPartenaires() {
  return useQuery({
    queryKey: ['banques-partenaires'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'banques_partenaires').maybeSingle();
      if (error) throw error;
      if (data?.valeur && Array.isArray(data.valeur)) return data.valeur as string[];
      return DEFAULT_BANQUES;
    },
  });
}

const TYPES = [
  { value: 'scolarite', label: 'Scolarité' },
  { value: 'transport', label: 'Transport' },
  { value: 'cantine', label: 'Cantine' },
  { value: 'uniforme', label: 'Uniforme/Boutique' },
  { value: 'fournitures', label: 'Fournitures' },
  { value: 'article', label: 'Article (Boutique)' },
  { value: 'autre', label: 'Autre' },
];

const MOIS_SCOLAIRES = [
  'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
];

const DEFAULT_TRANCHES = [
  { label: '1ère Tranche (Oct-Déc)', mois: ['Octobre', 'Novembre', 'Décembre'], montant: 0 },
  { label: '2ème Tranche (Jan-Mar)', mois: ['Janvier', 'Février', 'Mars'], montant: 0 },
  { label: '3ème Tranche (Avr-Juin)', mois: ['Avril', 'Mai', 'Juin'], montant: 0 },
];

type TrancheConfig = { label: string; mois: string[]; montant: number };

function useTranchesConfigV2() {
  return useQuery({
    queryKey: ['parametres-tranches-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'tranches_paiement_v2').maybeSingle();
      if (error) throw error;
      if (data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)) {
        return data.valeur as Record<string, TrancheConfig[]>;
      }
      return {} as Record<string, TrancheConfig[]>;
    },
  });
}

function getTranchesForNiveau(allTranches: Record<string, TrancheConfig[]>, niveauId: string | null): TrancheConfig[] {
  if (!niveauId || !allTranches[niveauId]) return DEFAULT_TRANCHES;
  return allTranches[niveauId];
}

// ─── Individual Student Payment Panel ─────────────────────
function PaiementIndividuelPanel({ eleves, paiements, articles, familles }: { eleves: any[]; paiements: any[]; articles: any[]; familles: any[] }) {
  const { data: allTranchesConfig = {} } = useTranchesConfigV2();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [eleveId, setEleveId] = useState('');
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState('especes');
  const [typePaiement, setTypePaiement] = useState('scolarite');
  const [reference, setReference] = useState('');
  const [moisCoches, setMoisCoches] = useState<string[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [articleQuantite, setArticleQuantite] = useState(1);
  const [banqueNom, setBanqueNom] = useState('');
  const [dateDepot, setDateDepot] = useState('');
  const [preuveFile, setPreuveFile] = useState<File | null>(null);
  const [uploadingPreuve, setUploadingPreuve] = useState(false);

  const { data: banques = DEFAULT_BANQUES } = useBanquesPartenaires();

  const selectedEleve = eleves.find((e: any) => e.id === eleveId);
  const niveauIdForTranches = selectedEleve?.classes?.niveau_id || null;
  const TRANCHES = useMemo(() => getTranchesForNiveau(allTranchesConfig, niveauIdForTranches), [allTranchesConfig, niveauIdForTranches]);

  // Anti-doublon: block scolarite/transport payment for family members
  const isFamilyMember = !!selectedEleve?.famille_id;
  const familyName = isFamilyMember ? familles.find((f: any) => f.id === selectedEleve.famille_id)?.nom_famille : null;

  const fraisMensuel = useMemo(() => {
    if (!selectedEleve) return 0;
    return Number(selectedEleve.classes?.niveaux?.frais_scolarite || 0);
  }, [selectedEleve]);

  const totalAnnuel = fraisMensuel * 9;

  const prixTransportMensuel = useMemo(() => {
    if (!selectedEleve) return 0;
    return Number((selectedEleve.zones_transport as any)?.prix_mensuel || 0);
  }, [selectedEleve]);
  const totalAnnuelTransport = prixTransportMensuel * 9;

  const paiementsScolariteEleve = useMemo(() => {
    if (!eleveId) return [];
    return paiements.filter((p: any) => p.eleve_id === eleveId && p.type_paiement === 'scolarite');
  }, [paiements, eleveId]);

  const paiementsTransportEleve = useMemo(() => {
    if (!eleveId) return [];
    return paiements.filter((p: any) => p.eleve_id === eleveId && p.type_paiement === 'transport');
  }, [paiements, eleveId]);

  const totalPaye = paiementsScolariteEleve.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const resteAPayer = Math.max(0, totalAnnuel - totalPaye);

  const totalPayeTransport = paiementsTransportEleve.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const resteAPayerTransport = Math.max(0, totalAnnuelTransport - totalPayeTransport);

  const moisPayes = useMemo(() => paiementsScolariteEleve.map((p: any) => p.mois_concerne).filter(Boolean) as string[], [paiementsScolariteEleve]);
  const moisPayesTransport = useMemo(() => paiementsTransportEleve.map((p: any) => p.mois_concerne).filter(Boolean) as string[], [paiementsTransportEleve]);

  const montantFromMois = useMemo(() => {
    if (typePaiement === 'scolarite') return moisCoches.length * fraisMensuel;
    if (typePaiement === 'transport') return moisCoches.length * prixTransportMensuel;
    return 0;
  }, [moisCoches, typePaiement, fraisMensuel, prixTransportMensuel]);

  const handleMoisToggle = (mois: string, checked: boolean) => {
    const next = checked ? [...moisCoches, mois] : moisCoches.filter(m => m !== mois);
    setMoisCoches(next);
    if (typePaiement === 'scolarite') setMontant(String(next.length * fraisMensuel));
    else if (typePaiement === 'transport') setMontant(String(next.length * prixTransportMensuel));
  };

  const selectedArticle = articles.find((a: any) => a.id === selectedArticleId);

  const uploadPreuve = async (): Promise<string | null> => {
    if (!preuveFile) return null;
    setUploadingPreuve(true);
    const ext = preuveFile.name.split('.').pop();
    const path = `${Date.now()}_${eleveId}.${ext}`;
    const { error } = await supabase.storage.from('preuves-paiement').upload(path, preuveFile);
    setUploadingPreuve(false);
    if (error) throw new Error('Erreur upload preuve: ' + error.message);
    const { data: urlData } = supabase.storage.from('preuves-paiement').getPublicUrl(path);
    return urlData.publicUrl;
  };

  const buildPaiementBase = async () => {
    const preuveUrl = await uploadPreuve();
    return {
      canal,
      reference: (canal !== 'especes' && reference) ? reference : null,
      banque_nom: canal === 'banque' ? banqueNom : null,
      date_depot: canal === 'banque' && dateDepot ? dateDepot : null,
      preuve_url: preuveUrl,
    };
  };

  const createPaiement = useMutation({
    mutationFn: async () => {
      if (!eleveId || !montant || parseFloat(montant) <= 0) throw new Error('Élève et montant valide requis');
      if (canal === 'banque' && !banqueNom) throw new Error('Veuillez sélectionner une banque');
      if (canal === 'banque' && !reference) throw new Error('La référence de transaction est obligatoire pour un paiement bancaire');
      if (canal === 'banque' && !dateDepot) throw new Error('La date de dépôt est obligatoire');
      if (isFamilyMember && (typePaiement === 'scolarite' || typePaiement === 'transport')) {
        throw new Error('Les paiements Scolarité/Transport pour cet élève doivent passer par le Compte Famille');
      }
      const base = await buildPaiementBase();
      if (typePaiement === 'article') {
        if (!selectedArticleId) throw new Error('Sélectionnez un article');
        if (selectedArticle && selectedArticle.stock < articleQuantite) throw new Error('Stock insuffisant');
        const { error: saleErr } = await supabase.from('ventes_articles' as any).insert({
          eleve_id: eleveId, article_id: selectedArticleId, quantite: articleQuantite, prix_unitaire: Number(selectedArticle?.prix || 0),
        });
        if (saleErr) throw saleErr;
        const { error } = await supabase.from('paiements').insert({
          eleve_id: eleveId, montant: parseFloat(montant), type_paiement: 'fournitures', mois_concerne: null, ...base,
        } as any);
        if (error) throw error;
      } else if (typePaiement === 'scolarite' || typePaiement === 'transport') {
        if (moisCoches.length === 0) throw new Error('Veuillez cocher au moins un mois');
        const montantParMois = typePaiement === 'scolarite' ? fraisMensuel : prixTransportMensuel;
        for (const mois of moisCoches) {
          const { error } = await supabase.from('paiements').insert({
            eleve_id: eleveId, montant: montantParMois, type_paiement: typePaiement, mois_concerne: mois, ...base,
          } as any);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('paiements').insert({
          eleve_id: eleveId, montant: parseFloat(montant), type_paiement: typePaiement, mois_concerne: null, ...base,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      toast({ title: 'Paiement enregistré', description: `${parseInt(montant).toLocaleString()} GNF` });

      if ((typePaiement === 'scolarite' || typePaiement === 'transport') && selectedEleve) {
        const isTransport = typePaiement === 'transport';
        const newTotalPaye = isTransport ? (totalPayeTransport + parseFloat(montant)) : (totalPaye + parseFloat(montant));
        const annuelCalc = isTransport ? totalAnnuelTransport : totalAnnuel;
        generateRecuPDF({
          type: typePaiement as 'scolarite' | 'transport',
          eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
          matricule: selectedEleve.matricule || '',
          classe: selectedEleve.classes?.nom || '—',
          montant: parseFloat(montant),
          mois: moisCoches.join(', '),
          canal: CANAUX.find(c => c.value === canal)?.label || canal,
          reference: (canal !== 'especes' && reference) ? reference : null,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
          totalAnnuel: annuelCalc,
          totalPaye: newTotalPaye,
          resteAPayer: Math.max(0, annuelCalc - newTotalPaye),
          zone: (selectedEleve.zones_transport as any)?.nom,
        });
      }

      setEleveId(''); setMontant(''); setCanal('especes'); setTypePaiement('scolarite'); setReference(''); setMoisCoches([]);
      setSelectedArticleId(''); setArticleQuantite(1); setBanqueNom(''); setDateDepot(''); setPreuveFile(null);
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Paiement Individuel</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Paiement — Élève Individuel</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Élève *</Label>
                <Select value={eleveId} onValueChange={setEleveId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner l'élève" /></SelectTrigger>
                  <SelectContent>
                    {eleves.filter((e: any) => !e.famille_id).map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} {e.matricule ? `(${e.matricule})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de paiement *</Label>
                <Select value={typePaiement} onValueChange={(v) => { setTypePaiement(v); setMoisCoches([]); setMontant(''); setSelectedArticleId(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => {
                      const disabled = t.value === 'transport' && selectedEleve && !selectedEleve.zone_transport_id;
                      // Anti-doublon: block scolarité/transport for family members
                      const blockedByFamily = isFamilyMember && (t.value === 'scolarite' || t.value === 'transport');
                      return <SelectItem key={t.value} value={t.value} disabled={disabled || blockedByFamily}>{t.label}{disabled ? ' (pas de zone)' : ''}{blockedByFamily ? ' (→ Compte Famille)' : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {isFamilyMember && (typePaiement === 'scolarite' || typePaiement === 'transport') && (
                  <p className="text-xs text-destructive mt-1">⚠️ Cet élève appartient à la famille <strong>{familyName}</strong>. Les paiements Scolarité/Transport doivent passer par l'onglet "Comptes Familles".</p>
                )}
              </div>

              {/* Article selection */}
              {typePaiement === 'article' && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label>Article *</Label>
                      <Select value={selectedArticleId} onValueChange={(v) => {
                        setSelectedArticleId(v);
                        const art = articles.find((a: any) => a.id === v);
                        if (art) setMontant(String(Number(art.prix) * articleQuantite));
                      }}>
                        <SelectTrigger><SelectValue placeholder="Choisir un article" /></SelectTrigger>
                        <SelectContent>
                          {articles.map((a: any) => (
                            <SelectItem key={a.id} value={a.id} disabled={a.stock <= 0}>
                              {a.nom} — {Number(a.prix).toLocaleString()} GNF (Stock: {a.stock})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Quantité</Label>
                      <Input type="number" min={1} max={selectedArticle?.stock || 1} value={articleQuantite} onChange={e => {
                        const q = Number(e.target.value);
                        setArticleQuantite(q);
                        if (selectedArticle) setMontant(String(Number(selectedArticle.prix) * q));
                      }} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Scolarité summary with tranches */}
              {selectedEleve && typePaiement === 'scolarite' && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div><p className="text-muted-foreground text-xs">Prix/mois</p><p className="font-bold">{fraisMensuel.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Total annuel</p><p className="font-bold">{totalAnnuel.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Déjà payé</p><p className="font-bold text-green-600">{totalPaye.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Reste</p><p className="font-bold text-destructive">{resteAPayer.toLocaleString()} GNF</p></div>
                    </div>
                    {/* Tranches shortcuts */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Payer par tranche :</p>
                      <div className="flex gap-2 flex-wrap">
                        {TRANCHES.map(t => {
                          const moisDispo = t.mois.filter(m => !moisPayes.includes(m));
                          const trancheMontant = t.montant > 0 ? t.montant : moisDispo.length * fraisMensuel;
                          if (moisDispo.length === 0) return <Badge key={t.label} variant="outline" className="text-green-600 border-green-300 text-xs">✓ {t.label}</Badge>;
                          return (
                            <Button key={t.label} variant="outline" size="sm" className="text-xs h-7" onClick={() => {
                              setMoisCoches(moisDispo);
                              setMontant(String(trancheMontant));
                            }}>
                              {t.label} ({trancheMontant.toLocaleString()} GNF)
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2">Ou cochez les mois :</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MOIS_SCOLAIRES.map(m => {
                          const isPaid = moisPayes.includes(m);
                          const isChecked = moisCoches.includes(m);
                          return (
                            <label key={m} className={`flex items-center gap-1.5 text-xs rounded px-2 py-1.5 cursor-pointer select-none ${isPaid ? 'bg-green-100 text-green-700' : isChecked ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                              {isPaid ? <CheckCircle className="h-3.5 w-3.5" /> : <Checkbox checked={isChecked} onCheckedChange={(checked) => handleMoisToggle(m, !!checked)} className="h-3.5 w-3.5" />}
                              {m}{isPaid ? ' ✓' : ''}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {moisCoches.length > 0 && (
                      <div className="text-center p-2 bg-primary/10 rounded-md">
                        <p className="text-xs text-muted-foreground">{moisCoches.length} mois × {fraisMensuel.toLocaleString()} GNF</p>
                        <p className="text-lg font-bold text-primary">{montantFromMois.toLocaleString()} GNF</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Transport summary */}
              {selectedEleve && typePaiement === 'transport' && selectedEleve.zones_transport && (
                <Card className="border-orange-300/50 bg-orange-50/50">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div><p className="text-muted-foreground text-xs">Prix/mois</p><p className="font-bold">{prixTransportMensuel.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Total annuel</p><p className="font-bold">{totalAnnuelTransport.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Déjà payé</p><p className="font-bold text-green-600">{totalPayeTransport.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Reste</p><p className="font-bold text-destructive">{resteAPayerTransport.toLocaleString()} GNF</p></div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2">Cochez les mois à payer :</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MOIS_SCOLAIRES.map(m => {
                          const isPaid = moisPayesTransport.includes(m);
                          const isChecked = moisCoches.includes(m);
                          return (
                            <label key={m} className={`flex items-center gap-1.5 text-xs rounded px-2 py-1.5 cursor-pointer select-none ${isPaid ? 'bg-green-100 text-green-700' : isChecked ? 'bg-orange-100 text-orange-700 border border-orange-300' : 'bg-muted text-muted-foreground'}`}>
                              {isPaid ? <CheckCircle className="h-3.5 w-3.5" /> : <Checkbox checked={isChecked} onCheckedChange={(checked) => handleMoisToggle(m, !!checked)} className="h-3.5 w-3.5" />}
                              {m}{isPaid ? ' ✓' : ''}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {moisCoches.length > 0 && (
                      <div className="text-center p-2 bg-orange-100 rounded-md">
                        <p className="text-xs text-muted-foreground">{moisCoches.length} mois × {prixTransportMensuel.toLocaleString()} GNF</p>
                        <p className="text-lg font-bold text-orange-700">{montantFromMois.toLocaleString()} GNF</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div>
                <Label>Montant (GNF) *</Label>
                <Input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0"
                  readOnly={typePaiement === 'scolarite' || typePaiement === 'transport' || typePaiement === 'article'}
                  className={(typePaiement === 'scolarite' || typePaiement === 'transport' || typePaiement === 'article') ? 'bg-muted cursor-not-allowed' : ''} />
              </div>
              <div>
                <Label>Canal *</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CANAUX.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(canal === 'orange_money' || canal === 'mtn_momo') && (
                <div><Label>Référence *</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° transaction" /></div>
              )}
              {canal === 'banque' && (
                <Card className="border-border bg-muted/30">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label>Banque *</Label>
                      <Select value={banqueNom} onValueChange={setBanqueNom}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner la banque" /></SelectTrigger>
                        <SelectContent>
                          {banques.map((b: string) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Référence de transaction *</Label>
                      <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° bordereau / chèque / virement" />
                    </div>
                    <div>
                      <Label>Date du dépôt *</Label>
                      <Input type="date" value={dateDepot} onChange={e => setDateDepot(e.target.value)} />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2"><FileImage className="h-4 w-4" /> Preuve de paiement (photo du bordereau)</Label>
                      <Input type="file" accept="image/*,.pdf" onChange={e => setPreuveFile(e.target.files?.[0] || null)} className="mt-1" />
                      {preuveFile && <p className="text-xs text-muted-foreground mt-1">📎 {preuveFile.name}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Button onClick={() => createPaiement.mutate()} disabled={createPaiement.isPending || uploadingPreuve} className="w-full">
                {uploadingPreuve ? 'Upload en cours...' : 'Enregistrer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ─── Family Account Payment Panel ──────────────────────────
function PaiementFamillePanel({ eleves, paiements, familles }: { eleves: any[]; paiements: any[]; familles: any[] }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [familleId, setFamilleId] = useState('');
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState('especes');
  const [reference, setReference] = useState('');
  const [banqueNom, setBanqueNom] = useState('');
  const [dateDepot, setDateDepot] = useState('');
  const [preuveFile, setPreuveFile] = useState<File | null>(null);
  const [uploadingPreuve, setUploadingPreuve] = useState(false);

  const { data: banques = DEFAULT_BANQUES } = useBanquesPartenaires();

  const familleEleves = useMemo(() => {
    if (!familleId) return [];
    return eleves.filter((e: any) => e.famille_id === familleId);
  }, [eleves, familleId]);

  const selectedFamille = familles.find((f: any) => f.id === familleId);

  // Total annual for family
  const totalAnnuelFamille = useMemo(() => {
    return familleEleves.reduce((sum: number, e: any) => {
      const frais = Number(e.classes?.niveaux?.frais_scolarite || 0);
      return sum + frais * 9;
    }, 0);
  }, [familleEleves]);

  // Total already paid for family
  const totalPayeFamille = useMemo(() => {
    const ids = familleEleves.map((e: any) => e.id);
    return paiements.filter((p: any) => ids.includes(p.eleve_id) && p.type_paiement === 'scolarite')
      .reduce((s: number, p: any) => s + Number(p.montant), 0);
  }, [paiements, familleEleves]);

  const resteFamille = Math.max(0, totalAnnuelFamille - totalPayeFamille);

  const createPaiementFamille = useMutation({
    mutationFn: async () => {
      if (!familleId || !montant || parseFloat(montant) <= 0) throw new Error('Famille et montant requis');
      if (familleEleves.length === 0) throw new Error('Aucun élève dans cette famille');

      if (canal === 'banque' && !banqueNom) throw new Error('Veuillez sélectionner une banque');
      if (canal === 'banque' && !reference) throw new Error('La référence de transaction est obligatoire');
      if (canal === 'banque' && !dateDepot) throw new Error('La date de dépôt est obligatoire');

      // Upload proof if provided
      let preuveUrl: string | null = null;
      if (preuveFile) {
        setUploadingPreuve(true);
        const ext = preuveFile.name.split('.').pop();
        const path = `famille_${familleId}_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('preuves-paiement').upload(path, preuveFile);
        setUploadingPreuve(false);
        if (upErr) throw new Error('Erreur upload: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('preuves-paiement').getPublicUrl(path);
        preuveUrl = urlData.publicUrl;
      }

      const baseFields = {
        canal,
        reference: (canal !== 'especes' && reference) ? reference : null,
        banque_nom: canal === 'banque' ? banqueNom : null,
        date_depot: canal === 'banque' && dateDepot ? dateDepot : null,
        preuve_url: preuveUrl,
      };

      // Distribute payment across children proportionally
      const totalM = parseFloat(montant);
      let remaining = totalM;
      for (let i = 0; i < familleEleves.length; i++) {
        const e = familleEleves[i];
        const fraisMensuel = Number(e.classes?.niveaux?.frais_scolarite || 0);
        const annuel = fraisMensuel * 9;
        const dejaPaye = paiements.filter((p: any) => p.eleve_id === e.id && p.type_paiement === 'scolarite').reduce((s: number, p: any) => s + Number(p.montant), 0);
        const resteEleve = Math.max(0, annuel - dejaPaye);
        if (resteEleve <= 0 || remaining <= 0) continue;
        const montantEleve = Math.min(remaining, resteEleve);
        remaining -= montantEleve;

        const { error } = await supabase.from('paiements').insert({
          eleve_id: e.id, montant: montantEleve, type_paiement: 'scolarite',
          mois_concerne: `Famille ${selectedFamille?.nom_famille}`,
          ...baseFields,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      toast({ title: 'Paiement famille enregistré', description: `${parseInt(montant).toLocaleString()} GNF pour la famille ${selectedFamille?.nom_famille}` });

      // Generate family receipt
      generateRecuFamillePDF({
        nomFamille: selectedFamille?.nom_famille || '',
        enfants: familleEleves.map((e: any) => ({
          nom: e.nom, prenom: e.prenom, matricule: e.matricule || '', classe: e.classes?.nom || '—',
        })),
        montant: parseFloat(montant),
        canal: CANAUX.find(c => c.value === canal)?.label || canal,
        reference: (canal !== 'especes' && reference) ? reference : null,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        totalAnnuel: totalAnnuelFamille,
        totalPaye: totalPayeFamille + parseFloat(montant),
        resteAPayer: Math.max(0, resteFamille - parseFloat(montant)),
      });

      setFamilleId(''); setMontant(''); setCanal('especes'); setReference(''); setBanqueNom(''); setDateDepot(''); setPreuveFile(null);
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // Family summary cards
  const famillesAvecEnfants = useMemo(() => {
    return familles.filter((f: any) => eleves.some((e: any) => e.famille_id === f.id)).map((f: any) => {
      const kids = eleves.filter((e: any) => e.famille_id === f.id);
      const annuel = kids.reduce((s: number, e: any) => s + Number(e.classes?.niveaux?.frais_scolarite || 0) * 9, 0);
      const paye = kids.reduce((s: number, e: any) => {
        return s + paiements.filter((p: any) => p.eleve_id === e.id && p.type_paiement === 'scolarite').reduce((ss: number, p: any) => ss + Number(p.montant), 0);
      }, 0);
      return { ...f, enfants: kids, annuel, paye, reste: Math.max(0, annuel - paye) };
    });
  }, [familles, eleves, paiements]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{famillesAvecEnfants.length} famille(s) avec enfants inscrits</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Paiement Famille</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Paiement — Compte Famille</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Famille *</Label>
                <Select value={familleId} onValueChange={setFamilleId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {famillesAvecEnfants.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>👨‍👩‍👧‍👦 {f.nom_famille} ({f.enfants.length} enfants)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {familleId && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-sm font-medium">Enfants :</p>
                    {familleEleves.map((e: any) => (
                      <div key={e.id} className="flex justify-between text-sm">
                        <span>{e.prenom} {e.nom} — {e.classes?.nom || '—'}</span>
                        <span className="text-muted-foreground">{(Number(e.classes?.niveaux?.frais_scolarite || 0) * 9).toLocaleString()} GNF/an</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-3 gap-2 text-center text-sm pt-2 border-t">
                      <div><p className="text-muted-foreground text-xs">Total annuel</p><p className="font-bold">{totalAnnuelFamille.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Déjà payé</p><p className="font-bold text-green-600">{totalPayeFamille.toLocaleString()} GNF</p></div>
                      <div><p className="text-muted-foreground text-xs">Reste</p><p className="font-bold text-destructive">{resteFamille.toLocaleString()} GNF</p></div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div><Label>Montant (GNF) *</Label><Input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" /></div>
              <div>
                <Label>Canal *</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CANAUX.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(canal === 'orange_money' || canal === 'mtn_momo') && (
                <div><Label>Référence *</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° transaction" /></div>
              )}
              {canal === 'banque' && (
                <Card className="border-border bg-muted/30">
                  <CardContent className="pt-4 space-y-3">
                    <div>
                      <Label>Banque *</Label>
                      <Select value={banqueNom} onValueChange={setBanqueNom}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner la banque" /></SelectTrigger>
                        <SelectContent>
                          {banques.map((b: string) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Référence de transaction *</Label>
                      <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° bordereau / chèque / virement" />
                    </div>
                    <div>
                      <Label>Date du dépôt *</Label>
                      <Input type="date" value={dateDepot} onChange={e => setDateDepot(e.target.value)} />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2"><FileImage className="h-4 w-4" /> Preuve de paiement</Label>
                      <Input type="file" accept="image/*,.pdf" onChange={e => setPreuveFile(e.target.files?.[0] || null)} className="mt-1" />
                      {preuveFile && <p className="text-xs text-muted-foreground mt-1">📎 {preuveFile.name}</p>}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Button onClick={() => createPaiementFamille.mutate()} disabled={createPaiementFamille.isPending || uploadingPreuve} className="w-full">
                {uploadingPreuve ? 'Upload en cours...' : 'Enregistrer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Family accounts list */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {famillesAvecEnfants.map((f: any) => (
          <Card key={f.id} className={f.reste > 0 ? 'border-destructive/20' : 'border-green-300/50'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> {f.nom_famille}
                <Badge variant="outline" className="ml-auto">{f.enfants.length} enfant(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {f.enfants.map((e: any) => (
                <p key={e.id} className="text-xs text-muted-foreground">{e.prenom} {e.nom} — {e.classes?.nom || '—'}</p>
              ))}
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t">
                <div><p className="text-muted-foreground">Annuel</p><p className="font-bold">{f.annuel.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Payé</p><p className="font-bold text-green-600">{f.paye.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Reste</p><p className="font-bold text-destructive">{f.reste.toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function Paiements() {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCanal, setFilterCanal] = useState('all');

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ['paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('*, eleves(nom, prenom, matricule, zone_transport_id, zones_transport:zone_transport_id(nom, prix_mensuel, chauffeur_bus, telephone_chauffeur))')
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves-for-paiement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, famille_id, option_cantine, solde_cantine, zone_transport_id, zones_transport:zone_transport_id(nom, prix_mensuel, chauffeur_bus, telephone_chauffeur), classes(nom, niveaux:niveau_id(frais_scolarite))')
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: familles = [] } = useQuery({
    queryKey: ['familles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('familles').select('*').order('nom_famille');
      if (error) throw error;
      return data;
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ['articles-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('articles' as any).select('*').order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = paiements.filter((p: any) => {
    const matchSearch = `${p.eleves?.nom} ${p.eleves?.prenom} ${p.reference || ''} ${p.eleves?.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || p.type_paiement === filterType;
    const matchCanal = filterCanal === 'all' || p.canal === filterCanal;
    return matchSearch && matchType && matchCanal;
  });

  const totalRecettes = filtered.reduce((sum: number, p: any) => sum + Number(p.montant), 0);

  const statsByType = TYPES.map(t => ({
    ...t,
    total: paiements.filter((p: any) => p.type_paiement === t.value).reduce((s: number, p: any) => s + Number(p.montant), 0),
    count: paiements.filter((p: any) => p.type_paiement === t.value).length,
  })).filter(s => s.total > 0);

  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthPaiements = paiements.filter((p: any) => {
        const pd = new Date(p.date_paiement);
        return pd >= start && pd <= end;
      });
      const byType: any = { mois: format(d, 'MMM yy', { locale: fr }) };
      TYPES.forEach(t => {
        byType[t.label] = monthPaiements.filter((p: any) => p.type_paiement === t.value).reduce((s: number, p: any) => s + Number(p.montant), 0);
      });
      months.push(byType);
    }
    return months;
  }, [paiements]);

  const typeColors = ['hsl(var(--primary))', '#f97316', '#22c55e', '#8b5cf6', '#06b6d4', '#ec4899', '#6b7280'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <CreditCard className="h-7 w-7 text-primary" /> Paiements
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {statsByType.map(s => (
          <Card key={s.value}>
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-lg font-bold">{s.total.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{s.count} paiement(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="individuel">
        <TabsList>
          <TabsTrigger value="individuel">🎓 Élèves Individuels</TabsTrigger>
          <TabsTrigger value="famille">👨‍👩‍👧‍👦 Comptes Familles</TabsTrigger>
          <TabsTrigger value="cantine">🍽️ Cantine</TabsTrigger>
          <TabsTrigger value="historique">📋 Historique</TabsTrigger>
          <TabsTrigger value="tendances">📊 Tendances</TabsTrigger>
        </TabsList>

        <TabsContent value="individuel" className="mt-4">
          <PaiementIndividuelPanel eleves={eleves} paiements={paiements} articles={articles} familles={familles} />
        </TabsContent>

        <TabsContent value="famille" className="mt-4">
          <PaiementFamillePanel eleves={eleves} paiements={paiements} familles={familles} />
        </TabsContent>

        <TabsContent value="cantine" className="mt-4">
          <CantineDirectePanel eleves={eleves} familles={familles} />
        </TabsContent>

        <TabsContent value="historique" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCanal} onValueChange={setFilterCanal}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les canaux</SelectItem>
                {CANAUX.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold">{totalRecettes.toLocaleString()} GNF</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const rows = filtered.map((p: any) => ({
                Date: format(new Date(p.date_paiement), 'dd/MM/yyyy', { locale: fr }),
                Élève: `${p.eleves?.prenom} ${p.eleves?.nom}`,
                Matricule: p.eleves?.matricule || '',
                Type: TYPES.find(t => t.value === p.type_paiement)?.label || p.type_paiement,
                Mois: (p as any).mois_concerne || '',
                'Montant (GNF)': Number(p.montant),
                Canal: CANAUX.find(c => c.value === p.canal)?.label || p.canal,
                Référence: p.reference || '',
                Banque: (p as any).banque_nom || '',
                'Date Dépôt': (p as any).date_depot || '',
              }));
              exportToExcel(rows, `paiements_${format(new Date(), 'yyyy-MM-dd')}`);
            }}>
              <Download className="h-4 w-4 mr-1" /> Exporter
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Matricule</TableHead>
                     <TableHead>Type</TableHead><TableHead>Mois</TableHead><TableHead>Montant</TableHead><TableHead>Canal</TableHead><TableHead>Réf</TableHead><TableHead>Banque</TableHead><TableHead className="w-10"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {isLoading ? (
                     <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                   ) : filtered.length === 0 ? (
                     <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucun paiement</TableCell></TableRow>
                   ) : filtered.map((p: any) => {
                     const eleveForReceipt = eleves.find((e: any) => e.id === p.eleve_id);
                     return (
                     <TableRow key={p.id}>
                       <TableCell className="text-xs">{format(new Date(p.date_paiement), 'dd MMM yyyy', { locale: fr })}</TableCell>
                       <TableCell className="font-medium">{p.eleves?.prenom} {p.eleves?.nom}</TableCell>
                       <TableCell className="font-mono text-xs">{p.eleves?.matricule || '—'}</TableCell>
                       <TableCell><Badge variant="outline">{TYPES.find(t => t.value === p.type_paiement)?.label || p.type_paiement}</Badge></TableCell>
                       <TableCell className="text-xs">{(p as any).mois_concerne || '—'}</TableCell>
                       <TableCell className="font-mono font-bold">{Number(p.montant).toLocaleString()} GNF</TableCell>
                       <TableCell><Badge variant={p.canal === 'especes' ? 'secondary' : p.canal === 'banque' ? 'outline' : 'default'}>{CANAUX.find(c => c.value === p.canal)?.label || p.canal}</Badge></TableCell>
                       <TableCell className="text-xs text-muted-foreground">{p.reference || '—'}</TableCell>
                       <TableCell className="text-xs">{(p as any).banque_nom || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" title="Imprimer reçu" onClick={() => {
                          if (p.type_paiement === 'scolarite' || p.type_paiement === 'transport') {
                            const isTransport = p.type_paiement === 'transport';
                            const transportZone = isTransport ? (p.eleves as any)?.zones_transport : null;
                            const prixMensuel = isTransport ? Number(transportZone?.prix_mensuel || 0) : Number(eleveForReceipt?.classes?.niveaux?.frais_scolarite || 0);
                            const annuelCalc = prixMensuel * 9;
                            const totalPayeType = paiements.filter((pp: any) => pp.eleve_id === p.eleve_id && pp.type_paiement === p.type_paiement).reduce((s: number, pp: any) => s + Number(pp.montant), 0);
                            generateRecuPDF({
                              type: p.type_paiement,
                              eleve: `${p.eleves?.prenom} ${p.eleves?.nom}`,
                              matricule: p.eleves?.matricule || '',
                              classe: eleveForReceipt?.classes?.nom || '—',
                              montant: Number(p.montant),
                              mois: (p as any).mois_concerne || '—',
                              canal: CANAUX.find(c => c.value === p.canal)?.label || p.canal,
                              reference: p.reference,
                              date: format(new Date(p.date_paiement), 'dd MMMM yyyy', { locale: fr }),
                              totalAnnuel: annuelCalc,
                              totalPaye: totalPayeType,
                              resteAPayer: Math.max(0, annuelCalc - totalPayeType),
                              zone: transportZone?.nom,
                            });
                          } else {
                            generateRecuGeneriquePDF({
                              type: p.type_paiement,
                              typeLabel: TYPES.find(t => t.value === p.type_paiement)?.label || p.type_paiement,
                              eleve: `${p.eleves?.prenom} ${p.eleves?.nom}`,
                              matricule: p.eleves?.matricule || '',
                              classe: eleveForReceipt?.classes?.nom || '—',
                              montant: Number(p.montant),
                              mois: (p as any).mois_concerne || null,
                              canal: CANAUX.find(c => c.value === p.canal)?.label || p.canal,
                              reference: p.reference,
                              date: format(new Date(p.date_paiement), 'dd MMMM yyyy', { locale: fr }),
                            });
                          }
                        }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">{filtered.length} paiement(s)</p>
        </TabsContent>

        <TabsContent value="tendances" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Recettes mensuelles par type (6 derniers mois)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="mois" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                    <Legend />
                    {TYPES.map((t, i) => (
                      <Bar key={t.value} dataKey={t.label} stackId="a" fill={typeColors[i]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
