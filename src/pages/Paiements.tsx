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
import { CreditCard, Plus, Search, TrendingUp, Wallet, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  // Suggest montant based on type
  const suggestedMontant = useMemo(() => {
    if (!selectedEleve) return null;
    if (typePaiement === 'scolarite') return Number(selectedEleve.classes?.niveaux?.frais_scolarite || 0);
    if (typePaiement === 'transport') return Number((selectedEleve.zones_transport as any)?.prix_mensuel || 0);
    return null;
  }, [selectedEleve, typePaiement]);

  const createPaiement = useMutation({
    mutationFn: async () => {
      if (!eleveId || !montant || parseFloat(montant) <= 0) throw new Error('Élève et montant valide requis');
      const { error } = await supabase.from('paiements').insert({
        eleve_id: eleveId, montant: parseFloat(montant), canal, type_paiement: typePaiement,
        reference: reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      toast({ title: 'Paiement enregistré', description: `${parseInt(montant).toLocaleString()} FCFA via ${CANAUX.find(c => c.value === canal)?.label}` });
      setEleveId(''); setMontant(''); setCanal('especes'); setTypePaiement('scolarite'); setReference('');
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

  // Stats by type
  const statsByType = TYPES.map(t => ({
    ...t,
    total: paiements.filter((p: any) => p.type_paiement === t.value).reduce((s: number, p: any) => s + Number(p.montant), 0),
    count: paiements.filter((p: any) => p.type_paiement === t.value).length,
  })).filter(s => s.total > 0);

  // Monthly chart data (last 6 months)
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
          <DialogContent className="max-w-md">
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
                <Select value={typePaiement} onValueChange={setTypePaiement}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => {
                      // Disable transport if no zone
                      const disabled = t.value === 'transport' && selectedEleve && !selectedEleve.zone_transport_id;
                      return <SelectItem key={t.value} value={t.value} disabled={disabled}>{t.label}{disabled ? ' (pas de zone)' : ''}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {selectedEleve && typePaiement === 'transport' && selectedEleve.zones_transport && (
                  <p className="text-xs text-muted-foreground mt-1">
                    🚌 Zone: {(selectedEleve.zones_transport as any)?.nom} — {Number((selectedEleve.zones_transport as any)?.prix_mensuel).toLocaleString()} FCFA/mois
                  </p>
                )}
              </div>
              <div>
                <Label>Montant (FCFA) *</Label>
                <Input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" />
                {suggestedMontant && suggestedMontant > 0 && montant !== String(suggestedMontant) && (
                  <button type="button" className="text-xs text-primary underline mt-1" onClick={() => setMontant(String(suggestedMontant))}>
                    💡 Montant suggéré: {suggestedMontant.toLocaleString()} FCFA — Cliquer pour appliquer
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
              {canal === 'especes' && (
                <div><Label>Référence (optionnel)</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° reçu" /></div>
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
          {/* Filters */}
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
              <span className="font-bold">{totalRecettes.toLocaleString()} FCFA</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Matricule</TableHead>
                    <TableHead>Type</TableHead><TableHead>Montant</TableHead><TableHead>Canal</TableHead><TableHead>Référence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun paiement</TableCell></TableRow>
                  ) : filtered.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{format(new Date(p.date_paiement), 'dd MMM yyyy', { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{p.eleves?.prenom} {p.eleves?.nom}</TableCell>
                      <TableCell className="font-mono text-xs">{p.eleves?.matricule || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{TYPES.find(t => t.value === p.type_paiement)?.label || p.type_paiement}</Badge></TableCell>
                      <TableCell className="font-mono font-bold">{Number(p.montant).toLocaleString()} F</TableCell>
                      <TableCell><Badge variant={p.canal === 'especes' ? 'secondary' : 'default'}>{CANAUX.find(c => c.value === p.canal)?.label || p.canal}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.reference || '—'}</TableCell>
                    </TableRow>
                  ))}
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
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
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
