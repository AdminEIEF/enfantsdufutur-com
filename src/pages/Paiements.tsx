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
import { CreditCard, Plus, Search, TrendingUp, Wallet, Smartphone, CheckCircle, Circle, Printer, Download, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { generateRecuPDF } from '@/lib/generateRecuPDF';
import { exportToExcel, readExcelFile } from '@/lib/excelUtils';

const CANAUX = [
  { value: 'especes', label: 'Espèces', icon: Wallet },
  { value: 'orange_money', label: 'Orange Money', icon: Smartphone },
  { value: 'mtn_momo', label: 'MTN MoMo', icon: Smartphone },
];

const TYPES = [
  { value: 'scolarite', label: 'Scolarité' },
  { value: 'transport', label: 'Transport' },
  { value: 'cantine', label: 'Cantine' },
  { value: 'uniforme', label: 'Uniforme/Boutique' },
  { value: 'fournitures', label: 'Fournitures' },
  { value: 'autre', label: 'Autre' },
];

const MOIS_SCOLAIRES = [
  'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
];

export default function Paiements() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCanal, setFilterCanal] = useState('all');
  const queryClient = useQueryClient();

  const [eleveId, setEleveId] = useState('');
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState('especes');
  const [typePaiement, setTypePaiement] = useState('scolarite');
  const [reference, setReference] = useState('');
  const [moisCoches, setMoisCoches] = useState<string[]>([]);

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ['paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('*, eleves(nom, prenom, matricule, zone_transport_id, zones_transport:zone_transport_id(nom, prix_mensuel))')
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
        .select('id, nom, prenom, matricule, zone_transport_id, zones_transport:zone_transport_id(nom, prix_mensuel), classes(nom, niveaux:niveau_id(frais_scolarite))')
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const selectedEleve = eleves.find((e: any) => e.id === eleveId);

  // Scolarité info for selected élève
  const fraisMensuel = useMemo(() => {
    if (!selectedEleve) return 0;
    return Number(selectedEleve.classes?.niveaux?.frais_scolarite || 0);
  }, [selectedEleve]);

  const totalAnnuel = fraisMensuel * 9;

  // Payments for selected élève (scolarité only)
  const paiementsScolariteEleve = useMemo(() => {
    if (!eleveId) return [];
    return paiements.filter((p: any) => p.eleve_id === eleveId && p.type_paiement === 'scolarite');
  }, [paiements, eleveId]);

  const totalPaye = paiementsScolariteEleve.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const resteAPayer = Math.max(0, totalAnnuel - totalPaye);

  const moisPayes = useMemo(() => {
    return paiementsScolariteEleve
      .map((p: any) => (p as any).mois_concerne)
      .filter(Boolean) as string[];
  }, [paiementsScolariteEleve]);

  // Auto-calculate montant from checked months
  const montantScolarite = moisCoches.length * fraisMensuel;

  // When moisCoches changes, update montant for scolarité
  const handleMoisToggle = (mois: string, checked: boolean) => {
    const next = checked ? [...moisCoches, mois] : moisCoches.filter(m => m !== mois);
    setMoisCoches(next);
    if (typePaiement === 'scolarite') {
      setMontant(String(next.length * fraisMensuel));
    }
  };

  // Auto-check months when montant is manually changed for scolarité
  const handleMontantChange = (val: string) => {
    setMontant(val);
    if (typePaiement === 'scolarite' && fraisMensuel > 0) {
      const nbMois = Math.floor(Number(val) / fraisMensuel);
      const moisDisponibles = MOIS_SCOLAIRES.filter(m => !moisPayes.includes(m));
      setMoisCoches(moisDisponibles.slice(0, nbMois));
    }
  };

  // Suggest montant based on type (transport only now)
  const suggestedMontant = useMemo(() => {
    if (!selectedEleve) return null;
    if (typePaiement === 'transport') return Number((selectedEleve.zones_transport as any)?.prix_mensuel || 0);
    return null;
  }, [selectedEleve, typePaiement]);

  const createPaiement = useMutation({
    mutationFn: async () => {
      if (!eleveId || !montant || parseFloat(montant) <= 0) throw new Error('Élève et montant valide requis');
      if (typePaiement === 'scolarite' && moisCoches.length === 0) throw new Error('Veuillez cocher au moins un mois');
      if (typePaiement === 'scolarite') {
        // Insert one payment per checked month
        const montantParMois = fraisMensuel;
        for (const mois of moisCoches) {
          const { error } = await supabase.from('paiements').insert({
            eleve_id: eleveId, montant: montantParMois, canal, type_paiement: typePaiement,
            reference: (canal !== 'especes' && reference) ? reference : null,
            mois_concerne: mois,
          } as any);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('paiements').insert({
          eleve_id: eleveId, montant: parseFloat(montant), canal, type_paiement: typePaiement,
          reference: (canal !== 'especes' && reference) ? reference : null,
          mois_concerne: null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      toast({ title: 'Paiement enregistré', description: `${parseInt(montant).toLocaleString()} GNF via ${CANAUX.find(c => c.value === canal)?.label}` });

      // Generate receipt for scolarité payments
      if (typePaiement === 'scolarite' && selectedEleve) {
        const newTotalPaye = totalPaye + parseFloat(montant);
        generateRecuPDF({
          eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
          matricule: selectedEleve.matricule || '',
          classe: selectedEleve.classes?.nom || '—',
          montant: parseFloat(montant),
          mois: moisCoches.join(', '),
          canal: CANAUX.find(c => c.value === canal)?.label || canal,
          reference: (canal !== 'especes' && reference) ? reference : null,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
          totalAnnuel,
          totalPaye: newTotalPaye,
          resteAPayer: Math.max(0, totalAnnuel - newTotalPaye),
        });
      }

      setEleveId(''); setMontant(''); setCanal('especes'); setTypePaiement('scolarite'); setReference(''); setMoisCoches([]);
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
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

  const typeColors = ['hsl(var(--primary))', '#f97316', '#22c55e', '#8b5cf6', '#06b6d4', '#6b7280'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" /> Paiements
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouveau Paiement</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Élève *</Label>
                <Select value={eleveId} onValueChange={setEleveId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner l'élève" /></SelectTrigger>
                  <SelectContent>
                    {eleves.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} {e.matricule ? `(${e.matricule})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de paiement *</Label>
                <Select value={typePaiement} onValueChange={(v) => { setTypePaiement(v); setMoisCoches([]); setMontant(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => {
                      const disabled = t.value === 'transport' && selectedEleve && !selectedEleve.zone_transport_id;
                      return <SelectItem key={t.value} value={t.value} disabled={disabled}>{t.label}{disabled ? ' (pas de zone)' : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {selectedEleve && typePaiement === 'transport' && selectedEleve.zones_transport && (
                  <p className="text-xs text-muted-foreground mt-1">
                    🚌 Zone: {(selectedEleve.zones_transport as any)?.nom} — {Number((selectedEleve.zones_transport as any)?.prix_mensuel).toLocaleString()} GNF/mois
                  </p>
                )}
              </div>

              {/* Scolarité summary */}
              {selectedEleve && typePaiement === 'scolarite' && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Prix mensuel</p>
                        <p className="font-bold">{fraisMensuel.toLocaleString()} GNF</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Total annuel (9 × {fraisMensuel.toLocaleString()})</p>
                        <p className="font-bold">{totalAnnuel.toLocaleString()} GNF</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Reste à payer</p>
                        <p className="font-bold text-destructive">{resteAPayer.toLocaleString()} GNF</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-2">Cochez les mois à payer :</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MOIS_SCOLAIRES.map(m => {
                          const isPaid = moisPayes.includes(m);
                          const isChecked = moisCoches.includes(m);
                          return (
                            <label key={m} className={`flex items-center gap-1.5 text-xs rounded px-2 py-1.5 cursor-pointer select-none ${isPaid ? 'bg-green-100 text-green-700' : isChecked ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                              {isPaid ? (
                                <CheckCircle className="h-3.5 w-3.5" />
                              ) : (
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleMoisToggle(m, !!checked)}
                                  className="h-3.5 w-3.5"
                                />
                              )}
                              {m}{isPaid ? ' ✓' : ''}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {moisCoches.length > 0 && (
                      <div className="text-center p-2 bg-primary/10 rounded-md">
                        <p className="text-xs text-muted-foreground">{moisCoches.length} mois × {fraisMensuel.toLocaleString()} GNF</p>
                        <p className="text-lg font-bold text-primary">{montantScolarite.toLocaleString()} GNF</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div>
                <Label>Montant (GNF) *</Label>
                <Input
                  type="number"
                  value={montant}
                  onChange={e => handleMontantChange(e.target.value)}
                  placeholder="0"
                  readOnly={typePaiement === 'scolarite'}
                  className={typePaiement === 'scolarite' ? 'bg-muted cursor-not-allowed' : ''}
                />
                {suggestedMontant && suggestedMontant > 0 && montant !== String(suggestedMontant) && (
                  <button type="button" className="text-xs text-primary underline mt-1" onClick={() => setMontant(String(suggestedMontant))}>
                    💡 Montant suggéré: {suggestedMontant.toLocaleString()} GNF — Cliquer pour appliquer
                  </button>
                )}
              </div>
              <div>
                <Label>Canal de paiement *</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CANAUX.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(canal === 'orange_money' || canal === 'mtn_momo') && (
                <div><Label>Référence transaction *</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° transaction mobile money" /></div>
              )}
              <Button onClick={() => createPaiement.mutate()} disabled={createPaiement.isPending} className="w-full">Enregistrer le paiement</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats by type */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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

      <Tabs defaultValue="historique">
        <TabsList><TabsTrigger value="historique">Historique</TabsTrigger><TabsTrigger value="tendances">Tendances</TabsTrigger></TabsList>

        <TabsContent value="historique" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher nom, matricule, référence..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
              <span className="text-muted-foreground">Total:</span>
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
              }));
              exportToExcel(rows, `paiements_${format(new Date(), 'yyyy-MM-dd')}`);
              toast({ title: 'Export réussi', description: `${rows.length} paiement(s) exporté(s)` });
            }}>
              <Download className="h-4 w-4 mr-1" /> Exporter
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const rows = await readExcelFile(file);
                    let imported = 0;
                    for (const row of rows) {
                      const eleve = eleves.find((el: any) =>
                        el.matricule === String(row['Matricule'] || '') ||
                        `${el.prenom} ${el.nom}` === String(row['Élève'] || '')
                      );
                      if (!eleve) continue;
                      const montantVal = Number(row['Montant (GNF)'] || row['Montant'] || 0);
                      if (montantVal <= 0) continue;
                      const typeVal = TYPES.find(t => t.label === String(row['Type'] || ''))?.value || 'autre';
                      const canalVal = CANAUX.find(c => c.label === String(row['Canal'] || ''))?.value || 'especes';
                      const { error } = await supabase.from('paiements').insert({
                        eleve_id: eleve.id,
                        montant: montantVal,
                        type_paiement: typeVal,
                        canal: canalVal,
                        reference: String(row['Référence'] || '') || null,
                        mois_concerne: typeVal === 'scolarite' ? String(row['Mois'] || '') || null : null,
                      } as any);
                      if (!error) imported++;
                    }
                    queryClient.invalidateQueries({ queryKey: ['paiements'] });
                    toast({ title: 'Import terminé', description: `${imported} paiement(s) importé(s) sur ${rows.length} ligne(s)` });
                  } catch (err: any) {
                    toast({ title: 'Erreur d\'import', description: err.message, variant: 'destructive' });
                  }
                  e.target.value = '';
                }}
              />
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" /> Importer
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Matricule</TableHead>
                    <TableHead>Type</TableHead><TableHead>Mois</TableHead><TableHead>Montant</TableHead><TableHead>Canal</TableHead><TableHead>Référence</TableHead><TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun paiement</TableCell></TableRow>
                  ) : filtered.map((p: any) => {
                    const eleveForReceipt = eleves.find((e: any) => e.id === p.eleve_id);
                    const frais = Number(eleveForReceipt?.classes?.niveaux?.frais_scolarite || 0);
                    const annuel = frais * 9;
                    const totalPayeEleve = paiements.filter((pp: any) => pp.eleve_id === p.eleve_id && pp.type_paiement === 'scolarite').reduce((s: number, pp: any) => s + Number(pp.montant), 0);
                    return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{format(new Date(p.date_paiement), 'dd MMM yyyy', { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{p.eleves?.prenom} {p.eleves?.nom}</TableCell>
                      <TableCell className="font-mono text-xs">{p.eleves?.matricule || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{TYPES.find(t => t.value === p.type_paiement)?.label || p.type_paiement}</Badge></TableCell>
                      <TableCell className="text-xs">{(p as any).mois_concerne || '—'}</TableCell>
                      <TableCell className="font-mono font-bold">{Number(p.montant).toLocaleString()} F</TableCell>
                      <TableCell><Badge variant={p.canal === 'especes' ? 'secondary' : 'default'}>{CANAUX.find(c => c.value === p.canal)?.label || p.canal}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.reference || '—'}</TableCell>
                      <TableCell>
                        {p.type_paiement === 'scolarite' && (
                          <Button variant="ghost" size="icon" title="Imprimer reçu" onClick={() => generateRecuPDF({
                            eleve: `${p.eleves?.prenom} ${p.eleves?.nom}`,
                            matricule: p.eleves?.matricule || '',
                            classe: eleveForReceipt?.classes?.nom || '—',
                            montant: Number(p.montant),
                            mois: (p as any).mois_concerne || '—',
                            canal: CANAUX.find(c => c.value === p.canal)?.label || p.canal,
                            reference: p.reference,
                            date: format(new Date(p.date_paiement), 'dd MMMM yyyy', { locale: fr }),
                            totalAnnuel: annuel,
                            totalPaye: totalPayeEleve,
                            resteAPayer: Math.max(0, annuel - totalPayeEleve),
                          })}>
                            <Printer className="h-4 w-4" />
                          </Button>
                        )}
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
