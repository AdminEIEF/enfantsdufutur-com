import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, CreditCard, BookOpen, GraduationCap, TrendingUp, Utensils, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight, DollarSign, UserX, ScanBarcode, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DashboardImpayesSection } from '@/components/DashboardImpayesSection';
import { DashboardRecouvrementSection } from '@/components/DashboardRecouvrementSection';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { toast } from 'sonner';

export default function Dashboard() {
  const { roles, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const canSeeFinance = hasAnyRole(['superviseur', 'admin', 'comptable', 'tresorier', 'secretaire']);
  

  // Redirect barcode scan to dedicated Scan Élève page
  useBarcodeScanner({ onScan: useCallback((code: string) => {
    navigate('/scan-eleve');
  }, [navigate]) });

  // ─── SINGLE optimized query ──────────────────────────
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw error;
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ─── Extract all KPIs from single response ──────────
  const totalEleves = stats?.total_eleves ?? 0;
  const totalAbandons = stats?.total_abandons ?? 0;
  const newInscriptions = stats?.new_inscriptions_mois ?? 0;
  const totalInscriptions = stats?.total_inscriptions_paiements ?? 0;
  const totalReinscriptions = stats?.total_reinscriptions_paiements ?? 0;
  const totalFamilles = stats?.total_familles ?? 0;
  const cantineInscrits = stats?.cantine_inscrits ?? 0;
  const cantineSoldeFaible = stats?.cantine_solde_faible ?? 0;
  const totalRecettes = Number(stats?.total_recettes ?? 0);
  const totalDepenses = Number(stats?.total_depenses ?? 0);
  const totalRecettesMois = Number(stats?.recettes_mois ?? 0);
  const totalDepensesMois = Number(stats?.depenses_mois ?? 0);
  const caLibrairie = Number(stats?.ca_librairie ?? 0);
  const caScolarite = Number(stats?.ca_scolarite ?? 0);
  const effectifParCycle = stats?.effectif_par_cycle ?? [];
  const recettesParType = stats?.recettes_par_type ?? [];
  const depensesParService = stats?.depenses_par_service ?? [];
  const monthlyTrend = stats?.monthly_trend ?? [];
  const recouvrementParClasse = (stats?.recouvrement_par_classe ?? []).map((c: any) => ({
    ...c,
    effectif: Number(c.effectif),
    totalAttendu: Number(c.total_attendu),
    totalPaye: Number(c.total_paye),
    taux: Number(c.taux),
    reste: Number(c.total_attendu) - Number(c.total_paye),
    nom: c.nom,
    cycleNom: c.cycle_nom,
  }));

  const CYCLE_ORDRE = ['Crèche', 'Maternelle', 'Primaire', 'Collège', 'Lycée'];
  const getCycleOrdre = (nom: string) => {
    const idx = CYCLE_ORDRE.findIndex(n => nom?.toUpperCase().includes(n.toUpperCase()));
    return idx >= 0 ? idx : 999;
  };

  const tauxGlobal = useMemo(() => {
    const totalAttendu = recouvrementParClasse.reduce((s: number, c: any) => s + c.totalAttendu, 0);
    const totalPaye = recouvrementParClasse.reduce((s: number, c: any) => s + c.totalPaye, 0);
    return totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0;
  }, [recouvrementParClasse]);

  const recouvrementParNiveau = useMemo(() => {
    const map: Record<string, any[]> = {};
    recouvrementParClasse.forEach((c: any) => {
      if (!map[c.cycleNom]) map[c.cycleNom] = [];
      map[c.cycleNom].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => getCycleOrdre(a) - getCycleOrdre(b));
  }, [recouvrementParClasse]);

  // Impayés simplified (from recouvrement data)
  const impayesFamilles = useMemo(() => {
    return recouvrementParClasse
      .filter((c: any) => c.reste > 0)
      .map((c: any) => ({ nom: c.nom, reste: c.reste, cycle: c.cycleNom }));
  }, [recouvrementParClasse]);

  const impayesParNiveau = useMemo(() => {
    const map: Record<string, typeof impayesFamilles> = {};
    impayesFamilles.forEach(f => {
      if (!map[f.cycle]) map[f.cycle] = [];
      map[f.cycle].push(f);
    });
    return Object.entries(map).sort(([a], [b]) => getCycleOrdre(a) - getCycleOrdre(b));
  }, [impayesFamilles]);

  // ─── Charts & finance computations ──────────────────
  const SERVICE_LABELS: Record<string, string> = {
    scolarite: 'Scolarité', transport: 'Transport', cantine: 'Cantine',
    uniforme: 'Boutique', fournitures: 'Fournitures', autre: 'Autre',
  };
  const DEP_TO_PAI: Record<string, string> = {
    'Scolarité': 'scolarite', 'Transport': 'transport', 'Cantine': 'cantine',
    'Boutique': 'uniforme', 'Librairie': 'fournitures', 'Fonctionnement': 'autre', 'Autre': 'autre',
  };

  const byService = useMemo(() => {
    const recMap: Record<string, number> = {};
    (recettesParType || []).forEach((r: any) => { recMap[r.name] = Number(r.value); });
    const depMap: Record<string, number> = {};
    (depensesParService || []).forEach((d: any) => { depMap[d.name] = Number(d.value); });

    const allLabels = [...new Set([
      ...Object.keys(recMap).map(k => SERVICE_LABELS[k] || k),
      ...Object.keys(depMap),
    ])];

    return allLabels.map(label => {
      const paiKey = Object.entries(SERVICE_LABELS).find(([, v]) => v === label)?.[0] || label;
      const recettes = recMap[paiKey] || 0;
      const depKey = Object.entries(DEP_TO_PAI).find(([, v]) => v === paiKey)?.[0] || label;
      const dep = depMap[depKey] || 0;
      const ir = dep > 0 ? parseFloat((recettes / dep).toFixed(2)) : recettes > 0 ? 999 : 0;
      return { service: label, recettes, depenses: dep, ir, marge: recettes - dep };
    }).filter(s => s.recettes > 0 || s.depenses > 0);
  }, [recettesParType, depensesParService]);

  const soldeNet = totalRecettes - totalDepenses;
  const indiceRentabilite = totalDepenses > 0 ? (totalRecettes / totalDepenses).toFixed(2) : '∞';

  const COLORS = [
    'hsl(220, 70%, 45%)',
    'hsl(38, 92%, 50%)',
    'hsl(162, 63%, 41%)',
    'hsl(200, 80%, 50%)',
    'hsl(0, 72%, 51%)',
    'hsl(280, 60%, 50%)',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Chargement du tableau de bord…</span>
      </div>
    );
  }

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

      {/* Scan result banner */}
      {scanResult && (
        <Card className="border-primary/30 bg-primary/5 animate-in fade-in slide-in-from-top-2">
          <CardContent className="pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ScanBarcode className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">{scanResult.prenom} {scanResult.nom}</p>
                <p className="text-sm text-muted-foreground">
                  {scanResult.matricule} — {(scanResult as any).classes?.nom || 'N/A'} — {(scanResult as any).classes?.niveaux?.nom || ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={scanResult.statut === 'actif' ? 'default' : 'destructive'}>{scanResult.statut}</Badge>
              <button onClick={() => setScanResult(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating scan indicator */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <div className="flex items-center gap-2 bg-muted/80 backdrop-blur rounded-full px-3 py-1.5 text-xs text-muted-foreground">
          <ScanBarcode className="h-3.5 w-3.5" />
          Scanner actif
        </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="overflow-hidden border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Élèves inscrits</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{totalEleves}</div>
            {newInscriptions > 0 && (
              <p className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                <ArrowUpRight className="h-3 w-3" /> +{newInscriptions} ce mois
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Inscriptions</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-emerald-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{totalInscriptions}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Nouvelles inscriptions</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Réinscriptions</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-violet-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-violet-700 dark:text-violet-400">{totalReinscriptions}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Réinscriptions</p>
          </CardContent>
        </Card>
        {canSeeFinance && (
        <Card className="overflow-hidden border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Recettes du mois</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-amber-700 dark:text-amber-400 truncate">{totalRecettesMois.toLocaleString()} <span className="text-[10px] font-normal">GNF</span></div>
          </CardContent>
        </Card>
        )}
        {canSeeFinance && (
        <Card className="overflow-hidden border border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Recouvrement</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-teal-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-teal-700 dark:text-teal-400">{tauxGlobal}%</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Taux global</p>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Abandon KPI */}
      {totalAbandons > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="border-destructive/30 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground truncate">Abandons</CardTitle>
              <UserX className="h-4 w-4 text-destructive shrink-0" />
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold text-destructive">{totalAbandons}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Élèves ayant abandonné</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Family & Financial KPIs - restricted */}
      {canSeeFinance && (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="overflow-hidden border border-red-200 dark:border-red-800 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Total Impayés</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-red-600 truncate">{impayesFamilles.reduce((s, f) => s + f.reste, 0).toLocaleString()} <span className="text-[10px] font-normal">GNF</span></div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{impayesFamilles.length} classes</p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Familles inscrites</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-indigo-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-indigo-700 dark:text-indigo-400">{totalFamilles}</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-sky-200 dark:border-sky-800 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">CA Scolarité</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-sky-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-sky-700 dark:text-sky-400 truncate">{caScolarite.toLocaleString()} <span className="text-[10px] font-normal">GNF</span></div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">CA Librairie</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-orange-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-orange-700 dark:text-orange-400 truncate">{caLibrairie.toLocaleString()} <span className="text-[10px] font-normal">GNF</span></div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Financial sections - restricted to finance roles */}
      {canSeeFinance && (
      <>
      {/* CA Comparatif Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">📊 Chiffre d'Affaires comparatif</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const recMap: Record<string, number> = {};
            (recettesParType || []).forEach((r: any) => { recMap[r.name] = Number(r.value); });
            const chartData = [
              { name: 'Scolarité', montant: caScolarite },
              { name: 'Transport', montant: recMap['transport'] || 0 },
              { name: 'Librairie', montant: caLibrairie },
              { name: 'Options/Boutique', montant: (recMap['article'] || 0) + (recMap['boutique'] || 0) + (recMap['fournitures'] || 0) + (recMap['uniforme'] || 0) + (recMap['cantine'] || 0) },
              { name: 'Inscriptions', montant: (recMap['inscription'] || 0) + (recMap['reinscription'] || 0) },
            ];
            const barColors = ['hsl(220, 70%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(280, 60%, 50%)', 'hsl(200, 80%, 50%)'];
            return chartData.some(d => d.montant > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} GNF`]} />
                  <Bar dataKey="montant" name="Montant" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={barColors[i % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">Aucune donnée financière</div>
            );
          })()}
        </CardContent>
      </Card>

      <DashboardImpayesSection impayesFamilles={impayesFamilles} impayesParNiveau={impayesParNiveau} />

      {/* Financial balance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 shadow-sm">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total recettes</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{totalRecettes.toLocaleString()} GNF</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-red-200 dark:border-red-800 bg-gradient-to-br from-red-500/15 to-red-500/5 shadow-sm">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <ArrowDownRight className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total dépenses</p>
              <p className="text-xl font-bold text-red-600">{totalDepenses.toLocaleString()} GNF</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border shadow-sm ${soldeNet >= 0 ? 'border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-500/15 to-teal-500/5' : 'border-red-200 dark:border-red-800 bg-gradient-to-br from-red-500/15 to-red-500/5'}`}>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${soldeNet >= 0 ? 'bg-teal-500/20' : 'bg-red-500/20'}`}>
              <Wallet className={`h-6 w-6 ${soldeNet >= 0 ? 'text-teal-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Solde net</p>
              <p className={`text-xl font-bold ${soldeNet >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'}`}>
                {soldeNet.toLocaleString()} GNF
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indice de Rentabilité par Service */}
      {byService.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" /> Indice de Rentabilité par Service
            </CardTitle>
            <p className="text-xs text-muted-foreground">IR global : <span className="font-bold">{indiceRentabilite}</span> (Recettes ÷ Dépenses)</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Recettes</TableHead>
                    <TableHead className="text-right">Dépenses</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                    <TableHead className="text-right">IR</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byService.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.service}</TableCell>
                      <TableCell className="text-right text-accent">{s.recettes.toLocaleString()} GNF</TableCell>
                      <TableCell className="text-right text-destructive">{s.depenses.toLocaleString()} GNF</TableCell>
                      <TableCell className={`text-right font-semibold ${s.marge >= 0 ? 'text-accent' : 'text-destructive'}`}>{s.marge.toLocaleString()} GNF</TableCell>
                      <TableCell className="text-right font-bold">{s.ir === 999 ? '∞' : s.ir}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={s.ir >= 1 ? 'default' : 'destructive'}>
                          {s.ir >= 2 ? 'Excellent' : s.ir >= 1.5 ? 'Bon' : s.ir >= 1 ? 'Rentable' : s.ir > 0 ? 'Déficitaire' : 'N/A'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right text-accent">{totalRecettes.toLocaleString()} GNF</TableCell>
                    <TableCell className="text-right text-destructive">{totalDepenses.toLocaleString()} GNF</TableCell>
                    <TableCell className={`text-right ${soldeNet >= 0 ? 'text-accent' : 'text-destructive'}`}>{soldeNet.toLocaleString()} GNF</TableCell>
                    <TableCell className="text-right">{indiceRentabilite}</TableCell>
                    <TableCell className="text-center"><Badge variant={soldeNet >= 0 ? 'default' : 'destructive'}>{soldeNet >= 0 ? 'Positif' : 'Négatif'}</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <DashboardRecouvrementSection recouvrementParNiveau={recouvrementParNiveau} tauxGlobal={tauxGlobal} />
      </>
      )}

      {/* Alertes cantine */}
      {cantineInscrits > 0 && (
        <Card className={cantineSoldeFaible > 0 ? 'border-warning/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Utensils className="h-5 w-5" /> Cantine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
        {/* Monthly trend - finance only */}
        {canSeeFinance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendance recettes / dépenses (6 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.some((m: any) => Number(m.recettes) > 0 || Number(m.depenses) > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mois" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                    formatter={(value: number) => [`${value.toLocaleString()} GNF`]}
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
        )}

        {/* Effectif par cycle - visible to all */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par cycle</CardTitle>
          </CardHeader>
          <CardContent>
            {effectifParCycle.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={effectifParCycle} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {effectifParCycle.map((_: any, i: number) => (
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

        {/* Recettes par type - finance only */}
        {canSeeFinance && (
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
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} GNF`]} />
                  <Bar dataKey="value" fill="hsl(220, 70%, 45%)" name="Montant" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucun paiement</div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Dépenses par service - finance only */}
        {canSeeFinance && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dépenses par service</CardTitle>
          </CardHeader>
          <CardContent>
            {depensesParService.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={depensesParService} cx="50%" cy="50%" outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }: any) => `${name}: ${Number(value).toLocaleString()}`}>
                    {depensesParService.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} GNF`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucune dépense</div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
