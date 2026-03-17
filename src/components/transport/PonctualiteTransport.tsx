import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clock, TrendingUp, AlertTriangle, CheckCircle, Bus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PonctualiteTransport() {
  const [periodFilter, setPeriodFilter] = useState('7');

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(periodFilter));
    return d.toISOString().slice(0, 10);
  }, [periodFilter]);

  const { data: trajets = [] } = useQuery({
    queryKey: ['trajets-transport', startDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trajets_transport')
        .select('*, routes_transport:route_id(nom, zone_transport_id, zones_transport:zone_transport_id(nom, chauffeur_bus))')
        .gte('date_trajet', startDate)
        .order('date_trajet', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const stats = useMemo(() => {
    const total = trajets.length;
    const aLHeure = trajets.filter(t => (t.retard_minutes || 0) <= 5).length;
    const retards = trajets.filter(t => (t.retard_minutes || 0) > 5).length;
    const retardMoyen = total > 0
      ? Math.round(trajets.reduce((s, t) => s + (t.retard_minutes || 0), 0) / total)
      : 0;
    const tauxPonctualite = total > 0 ? Math.round((aLHeure / total) * 100) : 100;

    // Par zone
    const parZone = new Map<string, { nom: string; chauffeur: string; total: number; aLHeure: number; retardTotal: number }>();
    trajets.forEach(t => {
      const zone = (t.routes_transport as any)?.zones_transport;
      const zoneNom = zone?.nom || 'Inconnue';
      const chauffeur = zone?.chauffeur_bus || '—';
      const key = zoneNom;
      if (!parZone.has(key)) parZone.set(key, { nom: zoneNom, chauffeur, total: 0, aLHeure: 0, retardTotal: 0 });
      const s = parZone.get(key)!;
      s.total++;
      if ((t.retard_minutes || 0) <= 5) s.aLHeure++;
      s.retardTotal += (t.retard_minutes || 0);
    });

    const zonesStats = Array.from(parZone.values()).map(z => ({
      ...z,
      taux: z.total > 0 ? Math.round((z.aLHeure / z.total) * 100) : 100,
      retardMoyen: z.total > 0 ? Math.round(z.retardTotal / z.total) : 0,
    })).sort((a, b) => a.taux - b.taux);

    return { total, aLHeure, retards, retardMoyen, tauxPonctualite, zonesStats };
  }, [trajets]);

  const chartData = stats.zonesStats.map(z => ({
    name: z.nom,
    taux: z.taux,
    fill: z.taux >= 90 ? 'hsl(162, 63%, 41%)' : z.taux >= 70 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)',
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Taux de ponctualité
        </h3>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="14">14 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">3 mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Bus className="h-7 w-7 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Trajets</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <CheckCircle className={`h-7 w-7 shrink-0 ${stats.tauxPonctualite >= 90 ? 'text-accent' : stats.tauxPonctualite >= 70 ? 'text-warning' : 'text-destructive'}`} />
            <div>
              <p className="text-xs text-muted-foreground">Ponctualité</p>
              <p className="text-xl font-bold">{stats.tauxPonctualite}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-warning shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Retards</p>
              <p className="text-xl font-bold">{stats.retards}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Clock className="h-7 w-7 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Retard moyen</p>
              <p className="text-xl font-bold">{stats.retardMoyen} min</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ponctualité par zone</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="taux" radius={[0, 4, 4, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Aucun trajet enregistré</div>
            )}
          </CardContent>
        </Card>

        {/* Table par zone */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Détail par zone/chauffeur</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Chauffeur</TableHead>
                  <TableHead className="text-center">Trajets</TableHead>
                  <TableHead className="text-center">Taux</TableHead>
                  <TableHead className="text-center">Retard moy.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.zonesStats.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Aucune donnée</TableCell></TableRow>
                ) : stats.zonesStats.map((z, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{z.nom}</TableCell>
                    <TableCell className="text-sm">{z.chauffeur}</TableCell>
                    <TableCell className="text-center">{z.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={z.taux >= 90 ? 'default' : z.taux >= 70 ? 'secondary' : 'destructive'}>
                        {z.taux}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{z.retardMoyen} min</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Derniers retards */}
      {trajets.filter(t => (t.retard_minutes || 0) > 5).length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Derniers retards signalés
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead className="text-center">Retard</TableHead>
                  <TableHead>Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trajets.filter(t => (t.retard_minutes || 0) > 5).slice(0, 10).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{new Date(t.date_trajet).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell className="font-medium text-sm">{(t.routes_transport as any)?.nom || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{t.type_trajet === 'aller' ? '🚌 Aller' : '🏠 Retour'}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge variant="destructive">{t.retard_minutes} min</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.motif_retard || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
