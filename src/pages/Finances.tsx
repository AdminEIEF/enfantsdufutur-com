import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const SERVICES = ['scolarite', 'transport', 'cantine', 'uniforme', 'fournitures'];
const SERVICE_LABELS: Record<string, string> = {
  scolarite: 'Scolarité', transport: 'Transport', cantine: 'Cantine',
  uniforme: 'Boutique/Uniformes', fournitures: 'Fournitures',
};
const COLORS = ['hsl(220, 70%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(162, 63%, 41%)', 'hsl(200, 80%, 50%)', 'hsl(0, 72%, 51%)'];

export default function Finances() {
  const [moisFilter, setMoisFilter] = useState('all');

  const { data: paiements = [] } = useQuery({
    queryKey: ['paiements-finance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('paiements').select('montant, type_paiement, date_paiement, canal');
      if (error) throw error;
      return data;
    },
  });

  const { data: depenses = [] } = useQuery({
    queryKey: ['depenses-finance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('depenses').select('montant, service, date_depense');
      if (error) throw error;
      return data;
    },
  });

  const filteredPaiements = useMemo(() => {
    if (moisFilter === 'all') return paiements;
    return paiements.filter((p: any) => new Date(p.date_paiement).getMonth() === parseInt(moisFilter));
  }, [paiements, moisFilter]);

  const filteredDepenses = useMemo(() => {
    if (moisFilter === 'all') return depenses;
    return depenses.filter((d: any) => new Date(d.date_depense).getMonth() === parseInt(moisFilter));
  }, [depenses, moisFilter]);

  const totalRecettes = filteredPaiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const totalDepenses = filteredDepenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
  const indiceRentabilite = totalDepenses > 0 ? (totalRecettes / totalDepenses).toFixed(2) : '∞';

  // By service
  const byService = useMemo(() => {
    return SERVICES.map(s => {
      const recettes = filteredPaiements.filter((p: any) => p.type_paiement === s).reduce((sum: number, p: any) => sum + Number(p.montant), 0);
      const dep = filteredDepenses.filter((d: any) => d.service === s).reduce((sum: number, d: any) => sum + Number(d.montant), 0);
      const ir = dep > 0 ? parseFloat((recettes / dep).toFixed(2)) : recettes > 0 ? 999 : 0;
      return { service: SERVICE_LABELS[s], recettes, depenses: dep, ir };
    });
  }, [filteredPaiements, filteredDepenses]);

  // By canal
  const byCanal = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPaiements.forEach((p: any) => { map[p.canal] = (map[p.canal] || 0) + Number(p.montant); });
    return Object.entries(map).map(([name, value]) => ({ name: name === 'especes' ? 'Espèces' : name === 'orange_money' ? 'Orange Money' : 'MTN MoMo', value }));
  }, [filteredPaiements]);

  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Tableau Financier
        </h1>
        <Select value={moisFilter} onValueChange={setMoisFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute l'année</SelectItem>
            {MOIS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Recettes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">{totalRecettes.toLocaleString()} FCFA</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown className="h-4 w-4" /> Dépenses</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalDepenses.toLocaleString()} FCFA</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4" /> Solde Net</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${totalRecettes - totalDepenses >= 0 ? 'text-success' : 'text-destructive'}`}>{(totalRecettes - totalDepenses).toLocaleString()} FCFA</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Indice de Rentabilité</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{indiceRentabilite}</p>
            <p className="text-xs text-muted-foreground">Recettes / Dépenses</p></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Recettes vs Dépenses par Service</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byService}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
                <Bar dataKey="recettes" fill="hsl(162, 63%, 41%)" name="Recettes" radius={[4,4,0,0]} />
                <Bar dataKey="depenses" fill="hsl(0, 72%, 51%)" name="Dépenses" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par Canal</CardTitle></CardHeader>
          <CardContent>
            {byCanal.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={byCanal} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {byCanal.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} FCFA`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-muted-foreground py-12">Aucun paiement enregistré</p>}
          </CardContent>
        </Card>
      </div>

      {/* IR table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Indice de Rentabilité par Service</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left p-3 font-medium text-muted-foreground">Service</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Recettes</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Dépenses</th>
                <th className="text-right p-3 font-medium text-muted-foreground">IR</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Statut</th>
              </tr></thead>
              <tbody>
                {byService.map((s, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3 font-medium">{s.service}</td>
                    <td className="p-3 text-right text-success">{s.recettes.toLocaleString()}</td>
                    <td className="p-3 text-right text-destructive">{s.depenses.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold">{s.ir === 999 ? '∞' : s.ir}</td>
                    <td className="p-3 text-center">
                      <Badge variant={s.ir >= 1 ? 'default' : 'destructive'}>
                        {s.ir >= 1.5 ? 'Excellent' : s.ir >= 1 ? 'Rentable' : s.ir > 0 ? 'Déficitaire' : 'N/A'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
