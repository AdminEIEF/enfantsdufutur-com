import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, CreditCard, BookOpen, GraduationCap, TrendingUp, Utensils, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

export default function Dashboard() {
  const { roles } = useAuth();

  const { data: eleves = [] } = useQuery({
    queryKey: ['dashboard-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, statut, option_cantine, solde_cantine, classe_id, created_at, classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom)))');
      if (error) throw error;
      return data;
    },
  });

  const { data: paiements = [] } = useQuery({
    queryKey: ['dashboard-paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('id, montant, type_paiement, date_paiement, canal')
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: depenses = [] } = useQuery({
    queryKey: ['dashboard-depenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('depenses')
        .select('id, montant, service, date_depense')
        .order('date_depense', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: notesCount = 0 } = useQuery({
    queryKey: ['dashboard-notes-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('notes').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  // ─── KPIs ──────────────────────────────────────────────
  const totalEleves = eleves.length;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const newInscriptions = eleves.filter((e: any) => e.created_at?.startsWith(thisMonth)).length;

  const paiementsMois = paiements.filter((p: any) => p.date_paiement?.startsWith(thisMonth));
  const totalRecettesMois = paiementsMois.reduce((s: number, p: any) => s + Number(p.montant), 0);

  const depensesMois = depenses.filter((d: any) => d.date_depense?.startsWith(thisMonth));
  const totalDepensesMois = depensesMois.reduce((s: number, d: any) => s + Number(d.montant), 0);

  const cantineInscrits = eleves.filter((e: any) => e.option_cantine).length;
  const cantineSoldeFaible = eleves.filter((e: any) => e.option_cantine && Number(e.solde_cantine || 0) < 1000).length;

  // ─── Charts data ──────────────────────────────────────
  // Recettes par type
  const recettesParType = useMemo(() => {
    const map: Record<string, number> = {};
    paiements.forEach((p: any) => {
      const type = p.type_paiement || 'Autre';
      map[type] = (map[type] || 0) + Number(p.montant);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [paiements]);

  // Dépenses par service
  const depensesParService = useMemo(() => {
    const map: Record<string, number> = {};
    depenses.forEach((d: any) => {
      const svc = d.service || 'Autre';
      map[svc] = (map[svc] || 0) + Number(d.montant);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [depenses]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map(m => {
      const recettes = paiements
        .filter((p: any) => p.date_paiement?.startsWith(m))
        .reduce((s: number, p: any) => s + Number(p.montant), 0);
      const depensesM = depenses
        .filter((d: any) => d.date_depense?.startsWith(m))
        .reduce((s: number, d: any) => s + Number(d.montant), 0);
      const [y, mo] = m.split('-');
      const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('fr-FR', { month: 'short' });
      return { mois: label, recettes, depenses: depensesM };
    });
  }, [paiements, depenses]);

  // Effectif par cycle
  const effectifParCycle = useMemo(() => {
    const map: Record<string, number> = {};
    eleves.forEach((e: any) => {
      const cycle = e.classes?.niveaux?.cycles?.nom || 'Non affecté';
      map[cycle] = (map[cycle] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [eleves]);

  // Canal paiements
  const paiementsParCanal = useMemo(() => {
    const map: Record<string, number> = {};
    paiements.forEach((p: any) => {
      const canal = p.canal || 'especes';
      map[canal] = (map[canal] || 0) + Number(p.montant);
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  }, [paiements]);

  const COLORS = [
    'hsl(220, 70%, 45%)',
    'hsl(38, 92%, 50%)',
    'hsl(162, 63%, 41%)',
    'hsl(200, 80%, 50%)',
    'hsl(0, 72%, 51%)',
    'hsl(280, 60%, 50%)',
  ];

  const totalRecettes = paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const totalDepenses = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          Tableau de bord
        </h1>
        <p className="text-muted-foreground mt-1">
          Bienvenue sur EduGestion Pro — Rôle(s) : {roles.length > 0 ? roles.join(', ') : 'Aucun rôle assigné'}
        </p>
      </div>

      {roles.length === 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div>
                <p className="font-medium">Aucun rôle assigné</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contactez un administrateur pour qu'il vous attribue un rôle.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Élèves inscrits</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEleves}</div>
            {newInscriptions > 0 && (
              <p className="text-xs text-accent flex items-center gap-1 mt-1">
                <ArrowUpRight className="h-3 w-3" /> +{newInscriptions} ce mois
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recettes du mois</CardTitle>
            <CreditCard className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecettesMois.toLocaleString()} <span className="text-sm font-normal">FCFA</span></div>
            <p className="text-xs text-muted-foreground mt-1">{paiementsMois.length} paiements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses du mois</CardTitle>
            <ArrowDownRight className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDepensesMois.toLocaleString()} <span className="text-sm font-normal">FCFA</span></div>
            <p className="text-xs text-muted-foreground mt-1">{depensesMois.length} dépenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notes saisies</CardTitle>
            <BookOpen className="h-5 w-5 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notesCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Financial balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-accent/30">
          <CardContent className="pt-6 flex items-center gap-4">
            <TrendingUp className="h-10 w-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Total recettes</p>
              <p className="text-xl font-bold">{totalRecettes.toLocaleString()} FCFA</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-center gap-4">
            <ArrowDownRight className="h-10 w-10 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Total dépenses</p>
              <p className="text-xl font-bold">{totalDepenses.toLocaleString()} FCFA</p>
            </div>
          </CardContent>
        </Card>
        <Card className={totalRecettes - totalDepenses >= 0 ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}>
          <CardContent className="pt-6 flex items-center gap-4">
            <Wallet className={`h-10 w-10 ${totalRecettes - totalDepenses >= 0 ? 'text-accent' : 'text-destructive'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Solde net</p>
              <p className={`text-xl font-bold ${totalRecettes - totalDepenses >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {(totalRecettes - totalDepenses).toLocaleString()} FCFA
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cantine alerts */}
      {cantineInscrits > 0 && (
        <Card className={cantineSoldeFaible > 0 ? 'border-warning/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Utensils className="h-5 w-5" /> Cantine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Inscrits</p>
                <p className="text-xl font-bold">{cantineInscrits}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde insuffisant</p>
                <p className="text-xl font-bold text-warning flex items-center gap-1">
                  {cantineSoldeFaible > 0 && <AlertTriangle className="h-4 w-4" />}
                  {cantineSoldeFaible}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendance recettes / dépenses (6 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.some(m => m.recettes > 0 || m.depenses > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mois" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                    formatter={(value: number) => [`${value.toLocaleString()} FCFA`]}
                  />
                  <Bar dataKey="recettes" fill="hsl(162, 63%, 41%)" name="Recettes" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="depenses" fill="hsl(0, 72%, 51%)" name="Dépenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucune donnée financière</div>
            )}
          </CardContent>
        </Card>

        {/* Effectif par cycle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par cycle</CardTitle>
          </CardHeader>
          <CardContent>
            {effectifParCycle.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={effectifParCycle} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {effectifParCycle.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucun élève inscrit</div>
            )}
          </CardContent>
        </Card>

        {/* Recettes par type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recettes par type de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            {recettesParType.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={recettesParType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} FCFA`]} />
                  <Bar dataKey="value" fill="hsl(220, 70%, 45%)" name="Montant" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucun paiement</div>
            )}
          </CardContent>
        </Card>

        {/* Dépenses par service */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dépenses par service</CardTitle>
          </CardHeader>
          <CardContent>
            {depensesParService.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={depensesParService} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value.toLocaleString()}`}>
                    {depensesParService.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} FCFA`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucune dépense</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
