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
import { Calculator, Plus, Search, TrendingDown, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const SERVICES = ['Scolarité', 'Transport', 'Boutique', 'Cantine', 'Autre'];

const SERVICE_COLORS: Record<string, string> = {
  'Scolarité': 'hsl(var(--primary))',
  'Transport': '#f97316',
  'Boutique': '#8b5cf6',
  'Cantine': '#22c55e',
  'Autre': '#6b7280',
};

const SERVICE_BADGE: Record<string, string> = {
  'Scolarité': 'bg-primary/10 text-primary',
  'Transport': 'bg-orange-100 text-orange-800',
  'Boutique': 'bg-purple-100 text-purple-800',
  'Cantine': 'bg-green-100 text-green-800',
  'Autre': 'bg-muted text-muted-foreground',
};

export default function Depenses() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterMois, setFilterMois] = useState<string>('all');
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [service, setService] = useState('');
  const [dateDepense, setDateDepense] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  const { data: depenses = [], isLoading } = useQuery({
    queryKey: ['depenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('depenses')
        .select('*')
        .order('date_depense', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createDepense = useMutation({
    mutationFn: async () => {
      if (!libelle.trim() || !montant || parseFloat(montant) <= 0 || !service) throw new Error('Tous les champs sont obligatoires');
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('depenses').insert({
        libelle: libelle.trim(),
        montant: parseFloat(montant),
        service,
        date_depense: dateDepense,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depenses'] });
      toast({ title: 'Dépense enregistrée', description: `${libelle} — ${parseInt(montant).toLocaleString()} GNF` });
      setLibelle(''); setMontant(''); setService(''); setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depenses'] });
      toast({ title: 'Dépense supprimée' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // Generate month options
  const moisOptions = useMemo(() => {
    const set = new Set<string>();
    depenses.forEach((d: any) => {
      const m = d.date_depense.substring(0, 7); // YYYY-MM
      set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [depenses]);

  const filtered = depenses.filter((d: any) => {
    const matchSearch = `${d.libelle} ${d.service}`.toLowerCase().includes(search.toLowerCase());
    const matchService = filterService === 'all' || d.service === filterService;
    const matchMois = filterMois === 'all' || d.date_depense.startsWith(filterMois);
    return matchSearch && matchService && matchMois;
  });

  const totalFiltered = filtered.reduce((s: number, d: any) => s + Number(d.montant), 0);
  const totalGeneral = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);

  // Stats by service
  const statsByService = SERVICES.map(s => ({
    name: s,
    total: depenses.filter((d: any) => d.service === s).reduce((sum: number, d: any) => sum + Number(d.montant), 0),
    count: depenses.filter((d: any) => d.service === s).length,
  }));

  // Pie data
  const pieData = statsByService.filter(s => s.total > 0);

  // Monthly chart (last 6 months)
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthDeps = depenses.filter((dep: any) => {
        const pd = new Date(dep.date_depense);
        return pd >= start && pd <= end;
      });
      const entry: any = { mois: format(d, 'MMM yy', { locale: fr }) };
      SERVICES.forEach(s => {
        entry[s] = monthDeps.filter((dep: any) => dep.service === s).reduce((sum: number, dep: any) => sum + Number(dep.montant), 0);
      });
      entry.total = monthDeps.reduce((sum: number, dep: any) => sum + Number(dep.montant), 0);
      months.push(entry);
    }
    return months;
  }, [depenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-7 w-7 text-primary" /> Dépenses
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouvelle Dépense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Enregistrer une dépense</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Libellé *</Label><Input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Ex: Carburant bus, Matériel cuisine" /></div>
              <div><Label>Montant (GNF) *</Label><Input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" /></div>
              <div>
                <Label>Service *</Label>
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger><SelectValue placeholder="Choisir un service" /></SelectTrigger>
                  <SelectContent>{SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={dateDepense} onChange={e => setDateDepense(e.target.value)} /></div>
              <Button onClick={() => createDepense.mutate()} disabled={createDepense.isPending} className="w-full">Enregistrer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">Total général</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3"><p className="text-lg font-bold">{totalGeneral.toLocaleString()} F</p></CardContent>
        </Card>
        {statsByService.filter(s => s.total > 0).map(s => (
          <Card key={s.name}>
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">{s.name}</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-lg font-bold">{s.total.toLocaleString()} F</p>
              <p className="text-xs text-muted-foreground">{s.count} opération(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="historique">
        <TabsList><TabsTrigger value="historique">Historique</TabsTrigger><TabsTrigger value="suivi">Suivi mensuel</TabsTrigger></TabsList>

        <TabsContent value="historique" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les services</SelectItem>
                {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMois} onValueChange={setFilterMois}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tous les mois" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                {moisOptions.map(m => <SelectItem key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: fr })}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold">{totalFiltered.toLocaleString()} GNF</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Libellé</TableHead><TableHead>Service</TableHead>
                    <TableHead className="text-right">Montant</TableHead><TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune dépense</TableCell></TableRow>
                  ) : filtered.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{format(new Date(d.date_depense), 'dd MMM yyyy', { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{d.libelle}</TableCell>
                      <TableCell><Badge className={SERVICE_BADGE[d.service] || ''}>{d.service}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{Number(d.montant).toLocaleString()} F</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">{filtered.length} dépense(s)</p>
        </TabsContent>

        <TabsContent value="suivi" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Dépenses mensuelles par service</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="mois" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                       <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                      <Legend />
                      {SERVICES.map(s => (
                        <Bar key={s} dataKey={s} stackId="a" fill={SERVICE_COLORS[s]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par service</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={SERVICE_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
