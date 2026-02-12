import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, Plus, Search, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SERVICES = ['Scolarité', 'Transport', 'Boutique', 'Cantine'];

const serviceColors: Record<string, string> = {
  'Scolarité': 'bg-blue-100 text-blue-800',
  'Transport': 'bg-orange-100 text-orange-800',
  'Boutique': 'bg-purple-100 text-purple-800',
  'Cantine': 'bg-green-100 text-green-800',
};

export default function Depenses() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
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
      if (!libelle.trim() || !montant || !service) throw new Error('Tous les champs sont obligatoires');
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
      queryClient.invalidateQueries({ queryKey: ['depenses-stats'] });
      toast({ title: 'Dépense enregistrée', description: `${libelle} — ${parseInt(montant).toLocaleString()} FCFA` });
      setLibelle(''); setMontant(''); setService(''); setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const filtered = depenses.filter((d: any) => {
    const matchSearch = `${d.libelle} ${d.service}`.toLowerCase().includes(search.toLowerCase());
    const matchService = filterService === 'all' || d.service === filterService;
    return matchSearch && matchService;
  });

  const totalFiltered = filtered.reduce((s: number, d: any) => s + Number(d.montant), 0);

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
              <div><Label>Libellé *</Label><Input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Ex: Carburant bus" /></div>
              <div><Label>Montant (FCFA) *</Label><Input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" /></div>
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
      <div className="grid gap-4 md:grid-cols-4">
        {SERVICES.map(s => {
          const total = depenses.filter((d: any) => d.service === s).reduce((sum: number, d: any) => sum + Number(d.montant), 0);
          return (
            <Card key={s}>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{s}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{total.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">FCFA</span></p></CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services</SelectItem>
            {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4" /> Total: <span className="font-bold text-foreground">{totalFiltered.toLocaleString()} FCFA</span>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucune dépense</TableCell></TableRow>
              ) : filtered.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>{format(new Date(d.date_depense), 'dd MMM yyyy', { locale: fr })}</TableCell>
                  <TableCell className="font-medium">{d.libelle}</TableCell>
                  <TableCell><Badge className={serviceColors[d.service] || ''}>{d.service}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{Number(d.montant).toLocaleString()} FCFA</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
