import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { FinanceTresorerieTab } from '@/components/FinanceTresorerieTab';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

const SERVICE_LABELS: Record<string, string> = {
  scolarite: 'Scolarité', transport: 'Transport', cantine: 'Cantine',
  uniforme: 'Boutique', fournitures: 'Fournitures', autre: 'Autre',
};
const DEP_SERVICE_MAP: Record<string, string> = {
  'Transport': 'transport', 'Cantine': 'cantine', 'Boutique': 'uniforme',
  'Librairie': 'fournitures', 'Fonctionnement': 'autre', 'Autre': 'autre',
};
const COLORS = ['hsl(var(--primary))', '#f97316', '#22c55e', '#8b5cf6', '#06b6d4', '#6b7280'];

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
      const { data, error } = await supabase.from('depenses').select('montant, service, date_depense, sous_categorie, statut').eq('statut', 'validee');
      if (error) throw error;
      return data;
    },
  });

  const { data: bulletinsPaie = [] } = useQuery({
    queryKey: ['bulletins-paie-finance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bulletins_paie').select('salaire_net, mois, annee, avances_deduites');
      if (error) throw error;
      return data;
    },
  });

  const { data: employesFinance = [] } = useQuery({
    queryKey: ['employes-finance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('employes').select('id, salaire_base, statut');
      if (error) throw error;
      return data;
    },
  });

  const { data: avancesFinance = [] } = useQuery({
    queryKey: ['avances-finance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('avances_salaire').select('montant, montant_rembourse, statut, created_at, employes(prenom, nom)');
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
  const soldeNet = totalRecettes - totalDepenses;
  const indiceRentabilite = totalDepenses > 0 ? (totalRecettes / totalDepenses).toFixed(2) : '∞';


  // Recettes vs Dépenses par service (pour le graphique bilan + rentabilité)
  const byService = useMemo(() => {
    const services = Object.values(SERVICE_LABELS);
    return services.map(label => {
      const paiKey = Object.entries(SERVICE_LABELS).find(([, v]) => v === label)?.[0];
      const recettes = paiKey ? filteredPaiements.filter((p: any) => p.type_paiement === paiKey).reduce((sum: number, p: any) => sum + Number(p.montant), 0) : 0;
      const depKey = Object.entries(DEP_SERVICE_MAP).find(([, v]) => v === paiKey)?.[0] || label;
      const dep = filteredDepenses.filter((d: any) => d.service === depKey).reduce((sum: number, d: any) => sum + Number(d.montant), 0);
      const marge = recettes - dep;
      const ir = dep > 0 ? parseFloat((recettes / dep).toFixed(2)) : recettes > 0 ? 999 : 0;
      return { service: label, recettes, depenses: dep, marge, ir };
    }).filter(s => s.recettes > 0 || s.depenses > 0);
  }, [filteredPaiements, filteredDepenses]);

  const byCanal = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPaiements.forEach((p: any) => { map[p.canal] = (map[p.canal] || 0) + Number(p.montant); });
    return Object.entries(map).map(([name, value]) => ({
      name: name === 'especes' ? 'Espèces' : name === 'orange_money' ? 'Orange Money' : 'MTN MoMo', value,
    }));
  }, [filteredPaiements]);

  // Monthly trend (12 months)
  const monthlyTrend = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const rec = paiements.filter((p: any) => { const pd = new Date(p.date_paiement); return pd >= start && pd <= end; })
        .reduce((s: number, p: any) => s + Number(p.montant), 0);
      const dep = depenses.filter((dd: any) => { const pd = new Date(dd.date_depense); return pd >= start && pd <= end; })
        .reduce((s: number, dd: any) => s + Number(dd.montant), 0);
      months.push({ mois: format(d, 'MMM yy', { locale: fr }), recettes: rec, depenses: dep, solde: rec - dep });
    }
    return months;
  }, [paiements, depenses]);

  // Projection: average of last 3 months projected forward 3 months
  const projection = useMemo(() => {
    const last3 = monthlyTrend.slice(-3);
    if (last3.length === 0) return [];
    const avgRec = last3.reduce((s, m) => s + m.recettes, 0) / last3.length;
    const avgDep = last3.reduce((s, m) => s + m.depenses, 0) / last3.length;
    const result = [...monthlyTrend.slice(-6).map(m => ({ ...m, recettes_proj: null as number | null, depenses_proj: null as number | null }))];
    for (let i = 1; i <= 3; i++) {
      const d = subMonths(new Date(), -i);
      result.push({
        mois: format(d, 'MMM yy', { locale: fr }),
        recettes: 0, depenses: 0, solde: 0,
        recettes_proj: Math.round(avgRec),
        depenses_proj: Math.round(avgDep),
      });
    }
    return result;
  }, [monthlyTrend]);

  // Month-over-month change
  const currentMonth = monthlyTrend[monthlyTrend.length - 1];
  const prevMonth = monthlyTrend[monthlyTrend.length - 2];
  const recChange = prevMonth && prevMonth.recettes > 0 ? ((currentMonth.recettes - prevMonth.recettes) / prevMonth.recettes * 100) : 0;
  const depChange = prevMonth && prevMonth.depenses > 0 ? ((currentMonth.depenses - prevMonth.depenses) / prevMonth.depenses * 100) : 0;

  const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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
          <CardContent>
            <p className="text-2xl font-bold text-success">{totalRecettes.toLocaleString()} GNF</p>
            {recChange !== 0 && (
              <p className={`text-xs flex items-center gap-1 ${recChange > 0 ? 'text-success' : 'text-destructive'}`}>
                {recChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(recChange).toFixed(1)}% vs mois précédent
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown className="h-4 w-4" /> Dépenses</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{totalDepenses.toLocaleString()} GNF</p>
            {depChange !== 0 && (
              <p className={`text-xs flex items-center gap-1 ${depChange < 0 ? 'text-success' : 'text-destructive'}`}>
                {depChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(depChange).toFixed(1)}% vs mois précédent
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><DollarSign className="h-4 w-4" /> Solde Net</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${soldeNet >= 0 ? 'text-success' : 'text-destructive'}`}>{soldeNet.toLocaleString()} GNF</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Indice de Rentabilité</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{indiceRentabilite}</p>
            <p className="text-xs text-muted-foreground">Recettes ÷ Dépenses</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bilan">
        <TabsList className="flex-wrap"><TabsTrigger value="bilan">Bilan</TabsTrigger><TabsTrigger value="tendances">Tendances</TabsTrigger><TabsTrigger value="projection">Projection</TabsTrigger><TabsTrigger value="rentabilite">Rentabilité</TabsTrigger><TabsTrigger value="tresorerie">Trésorerie</TabsTrigger></TabsList>

        {/* Bilan */}
        <TabsContent value="bilan" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Recettes vs Dépenses par Service</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={byService}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                    <Legend />
                    <Bar dataKey="recettes" fill="#22c55e" name="Recettes" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par Canal de paiement</CardTitle></CardHeader>
              <CardContent>
                {byCanal.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={byCanal} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {byCanal.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-12">Aucun paiement</p>}
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* Tendances */}
        <TabsContent value="tendances" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Évolution mensuelle (12 derniers mois)</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                    <Legend />
                    <Area type="monotone" dataKey="recettes" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} name="Recettes" />
                    <Area type="monotone" dataKey="depenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Dépenses" />
                    <Line type="monotone" dataKey="solde" stroke="hsl(var(--primary))" strokeWidth={2} name="Solde net" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projection */}
        <TabsContent value="projection" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projection à 3 mois</CardTitle>
              <p className="text-sm text-muted-foreground">Basée sur la moyenne des 3 derniers mois</p>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projection}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mois" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => v ? `${v.toLocaleString()} GNF` : '—'} />
                    <Legend />
                    <Line type="monotone" dataKey="recettes" stroke="#22c55e" strokeWidth={2} name="Recettes (réel)" dot />
                    <Line type="monotone" dataKey="depenses" stroke="#ef4444" strokeWidth={2} name="Dépenses (réel)" dot />
                    <Line type="monotone" dataKey="recettes_proj" stroke="#22c55e" strokeWidth={2} strokeDasharray="8 4" name="Recettes (proj.)" dot />
                    <Line type="monotone" dataKey="depenses_proj" stroke="#ef4444" strokeWidth={2} strokeDasharray="8 4" name="Dépenses (proj.)" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {projection.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {projection.filter(p => p.recettes_proj !== null).map((p, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{p.mois}</CardTitle></CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Recettes prévues</span><span className="font-semibold text-success">{p.recettes_proj?.toLocaleString()} GNF</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Dépenses prévues</span><span className="font-semibold text-destructive">{p.depenses_proj?.toLocaleString()} GNF</span></div>
                    <div className="flex justify-between border-t pt-1"><span className="font-medium">Solde projeté</span><span className="font-bold">{((p.recettes_proj || 0) - (p.depenses_proj || 0)).toLocaleString()} GNF</span></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rentabilité */}
        <TabsContent value="rentabilite" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indice de Rentabilité par Service</CardTitle>
              <p className="text-sm text-muted-foreground">IR = Recettes ÷ Dépenses • Filtré par mois sélectionné</p>
            </CardHeader>
            <CardContent>
              {byService.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucune donnée pour la période sélectionnée.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Service</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Recettes</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Dépenses</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Marge</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">IR</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byService.map((s) => (
                        <tr key={s.service} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 font-medium">{s.service}</td>
                          <td className="py-2 px-3 text-right text-success">{s.recettes.toLocaleString()} GNF</td>
                          <td className="py-2 px-3 text-right text-destructive">{s.depenses.toLocaleString()} GNF</td>
                          <td className={`py-2 px-3 text-right font-semibold ${s.marge >= 0 ? 'text-success' : 'text-destructive'}`}>{s.marge.toLocaleString()} GNF</td>
                          <td className="py-2 px-3 text-right font-bold">{s.ir >= 999 ? '∞' : s.ir.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant={s.ir >= 1.5 ? 'default' : s.ir >= 1 ? 'secondary' : 'destructive'}>
                              {s.ir >= 1.5 ? 'Rentable' : s.ir >= 1 ? 'Équilibre' : 'Déficitaire'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-bold">
                        <td className="py-2 px-3">TOTAL</td>
                        <td className="py-2 px-3 text-right text-success">{totalRecettes.toLocaleString()} GNF</td>
                        <td className="py-2 px-3 text-right text-destructive">{totalDepenses.toLocaleString()} GNF</td>
                        <td className={`py-2 px-3 text-right ${soldeNet >= 0 ? 'text-success' : 'text-destructive'}`}>{soldeNet.toLocaleString()} GNF</td>
                        <td className="py-2 px-3 text-right">{indiceRentabilite}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={parseFloat(indiceRentabilite) >= 1.5 ? 'default' : parseFloat(indiceRentabilite) >= 1 ? 'secondary' : 'destructive'}>
                            {parseFloat(indiceRentabilite) >= 1.5 ? 'Rentable' : parseFloat(indiceRentabilite) >= 1 ? 'Équilibre' : 'Déficitaire'}
                          </Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trésorerie */}
        <TabsContent value="tresorerie" className="mt-4">
          <FinanceTresorerieTab
            paiements={paiements}
            depenses={depenses}
            bulletins={bulletinsPaie}
            employes={employesFinance}
            avances={avancesFinance}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
