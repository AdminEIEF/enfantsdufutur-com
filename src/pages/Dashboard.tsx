import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, CreditCard, BookOpen, GraduationCap, TrendingUp, Utensils, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight, DollarSign, UserX, ScanBarcode } from 'lucide-react';
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
  const canSeeFinance = hasAnyRole(['superviseur', 'admin', 'comptable', 'tresorier']);
  const [scanResult, setScanResult] = useState<any>(null);

  const handleSearchStudent = useCallback(async (matricule: string) => {
    toast.info(`🔍 Recherche: ${matricule}...`);
    try {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, qr_code, statut, classe_id, classes(nom, niveaux:niveau_id(nom))')
        .is('deleted_at', null)
        .or(`matricule.eq.${matricule},qr_code.eq.${matricule}`)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setScanResult(data);
        toast.success(`✅ ${data.prenom} ${data.nom} — ${(data as any).classes?.nom || ''}`);
      } else {
        setScanResult(null);
        toast.error(`Aucun élève trouvé pour "${matricule}"`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de recherche');
    }
  }, []);

  useBarcodeScanner({ onScan: handleSearchStudent });

  const { data: eleves = [] } = useQuery({
    queryKey: ['dashboard-eleves'],
    queryFn: async () => {
      const selectFields = 'id, nom, prenom, statut, option_cantine, solde_cantine, classe_id, famille_id, created_at, classes(nom, niveau_id, niveaux:niveau_id(nom, frais_scolarite, cycles:cycle_id(nom)))';
      const allData: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('eleves')
          .select(selectFields)
          .is('deleted_at', null)
          .order('nom')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allData.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return allData;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: paiements = [] } = useQuery({
    queryKey: ['dashboard-paiements'],
    queryFn: async () => {
      const allData: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('paiements')
          .select('id, montant, type_paiement, date_paiement, canal, eleve_id')
          .order('date_paiement', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allData.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return allData;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: depenses = [] } = useQuery({
    queryKey: ['dashboard-depenses'],
    queryFn: async () => {
      const allData: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('depenses')
          .select('id, montant, service, date_depense')
          .order('date_depense', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allData.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      return allData;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: notesCount = 0 } = useQuery({
    queryKey: ['dashboard-notes-count'],
    queryFn: async () => {
      const { count, error } = await supabase.from('notes').select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: familles = [] } = useQuery({
    queryKey: ['dashboard-familles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('familles').select('id, nom_famille');
      if (error) throw error;
      return data;
    },
  });

  const { data: ventesArticles = [] } = useQuery({
    queryKey: ['dashboard-ventes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ventes_articles' as any).select('id, prix_unitaire, quantite');
      if (error) throw error;
      return data as any[];
    },
  });

  // ─── KPIs ──────────────────────────────────────────────
  const totalEleves = eleves.length;
  const totalAbandons = eleves.filter((e: any) => e.statut === 'abandon').length;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const newInscriptions = eleves.filter((e: any) => e.created_at?.startsWith(thisMonth)).length;

  // Separate inscription vs réinscription counts
  const { data: paiementsInscription = [] } = useQuery({
    queryKey: ['dashboard-paiements-inscription'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('id, type_paiement')
        .in('type_paiement', ['inscription', 'reinscription']);
      if (error) throw error;
      return data;
    },
  });
  const totalInscriptions = paiementsInscription.filter((p: any) => p.type_paiement === 'inscription').length;
  const totalReinscriptions = paiementsInscription.filter((p: any) => p.type_paiement === 'reinscription').length;

  // Family KPIs
  const totalFamilles = familles.length;
  const enfantsEnFratrie = useMemo(() => {
    const familleIds = new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id));
    let count = 0;
    familleIds.forEach(fid => {
      const kids = eleves.filter((e: any) => e.famille_id === fid);
      if (kids.length > 1) count += kids.length;
    });
    return count;
  }, [eleves]);

  // CA Librairie
  const caLibrairie = ventesArticles.reduce((s: number, v: any) => s + Number(v.prix_unitaire) * v.quantite, 0);
  const caScolarite = paiements.filter((p: any) => p.type_paiement === 'scolarite').reduce((s: number, p: any) => s + Number(p.montant), 0);

  // ─── Ordre pédagogique des cycles ──────────────────
  const CYCLE_ORDRE = ['Crèche', 'Maternelle', 'Primaire', 'Collège', 'Lycée'];
  const getCycleOrdre = (nom: string) => {
    const idx = CYCLE_ORDRE.findIndex(n => nom.toUpperCase().includes(n.toUpperCase()));
    return idx >= 0 ? idx : 999;
  };

  // Impayés par famille
  const impayesFamilles = useMemo(() => {
    const familleIds = new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id));
    const result: { nom: string; reste: number; cycle: string }[] = [];
    familleIds.forEach(fid => {
      const kids = eleves.filter((e: any) => e.famille_id === fid);
      const fam = familles.find((f: any) => f.id === fid);
      const annuel = kids.reduce((s: number, e: any) => s + Number(e.classes?.niveaux?.frais_scolarite || 0), 0);
      const paye = kids.reduce((s: number, e: any) => s + paiements.filter((p: any) => p.eleve_id === e.id && p.type_paiement === 'scolarite').reduce((ss: number, p: any) => ss + Number(p.montant), 0), 0);
      const reste = annuel - paye;
      const cycles = kids.map((e: any) => e.classes?.niveaux?.cycles?.nom).filter(Boolean);
      const cycle = cycles[0] || 'Non classé';
      if (reste > 0) result.push({ nom: fam?.nom_famille || 'Inconnue', reste, cycle });
    });
    return result.sort((a, b) => b.reste - a.reste);
  }, [eleves, paiements, familles]);

  // Group impayés by cycle
  const impayesParNiveau = useMemo(() => {
    const map: Record<string, typeof impayesFamilles> = {};
    impayesFamilles.forEach(f => {
      if (!map[f.cycle]) map[f.cycle] = [];
      map[f.cycle].push(f);
    });
    return Object.entries(map).sort(([a], [b]) => getCycleOrdre(a) - getCycleOrdre(b));
  }, [impayesFamilles]);

  const paiementsMois = paiements.filter((p: any) => p.date_paiement?.startsWith(thisMonth));
  const totalRecettesMois = paiementsMois.reduce((s: number, p: any) => s + Number(p.montant), 0);

  const depensesMois = depenses.filter((d: any) => d.date_depense?.startsWith(thisMonth));
  const totalDepensesMois = depensesMois.reduce((s: number, d: any) => s + Number(d.montant), 0);

  const cantineInscrits = eleves.filter((e: any) => e.option_cantine).length;
  const cantineSoldeFaible = eleves.filter((e: any) => e.option_cantine && Number(e.solde_cantine || 0) < 1000).length;

  // ─── Taux de recouvrement par classe ──────────────────
  const recouvrementParClasse = useMemo(() => {
    const classeMap: Record<string, { nom: string; cycleNom: string; totalAttendu: number; totalPaye: number; effectif: number }> = {};

    eleves.forEach((e: any) => {
      if (!e.classe_id || !e.classes) return;
      const classeNom = e.classes.nom;
      const cycleNom = e.classes.niveaux?.cycles?.nom || 'Non classé';
      const totalAnnuel = Number(e.classes.niveaux?.frais_scolarite || 0);

      if (!classeMap[e.classe_id]) {
        classeMap[e.classe_id] = { nom: classeNom, cycleNom, totalAttendu: 0, totalPaye: 0, effectif: 0 };
      }
      classeMap[e.classe_id].totalAttendu += totalAnnuel;
      classeMap[e.classe_id].effectif += 1;
    });

    // Sum scolarité payments per class
    paiements.filter((p: any) => p.type_paiement === 'scolarite').forEach((p: any) => {
      const eleve = eleves.find((e: any) => e.id === p.eleve_id);
      if (eleve?.classe_id && classeMap[eleve.classe_id]) {
        classeMap[eleve.classe_id].totalPaye += Number(p.montant);
      }
    });

    return Object.values(classeMap)
      .filter(c => c.totalAttendu > 0)
      .map(c => ({
        ...c,
        taux: Math.min(100, Math.round((c.totalPaye / c.totalAttendu) * 100)),
        reste: c.totalAttendu - c.totalPaye,
      }))
      .sort((a, b) => getCycleOrdre(a.cycleNom) - getCycleOrdre(b.cycleNom) || a.nom.localeCompare(b.nom));
  }, [eleves, paiements]);

  // Group recouvrement by cycle
  const recouvrementParNiveau = useMemo(() => {
    const map: Record<string, typeof recouvrementParClasse> = {};
    recouvrementParClasse.forEach(c => {
      if (!map[c.cycleNom]) map[c.cycleNom] = [];
      map[c.cycleNom].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => getCycleOrdre(a) - getCycleOrdre(b));
  }, [recouvrementParClasse]);

  const tauxGlobal = useMemo(() => {
    const totalAttendu = recouvrementParClasse.reduce((s, c) => s + c.totalAttendu, 0);
    const totalPaye = recouvrementParClasse.reduce((s, c) => s + c.totalPaye, 0);
    return totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0;
  }, [recouvrementParClasse]);

  // ─── Alertes cantine détaillées ──────────────────────
  const alertesCantine = useMemo(() => {
    return eleves
      .filter((e: any) => e.option_cantine && Number(e.solde_cantine || 0) < 1000)
      .map((e: any) => ({
        id: e.id,
        nom: `${e.prenom} ${e.nom}`,
        classe: e.classes?.nom || '—',
        solde: Number(e.solde_cantine || 0),
      }))
      .sort((a, b) => a.solde - b.solde);
  }, [eleves]);

  // ─── Charts data ──────────────────────────────────────
  const recettesParType = useMemo(() => {
    const map: Record<string, number> = {};
    paiements.forEach((p: any) => {
      const type = p.type_paiement || 'Autre';
      map[type] = (map[type] || 0) + Number(p.montant);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [paiements]);

  const depensesParService = useMemo(() => {
    const map: Record<string, number> = {};
    depenses.forEach((d: any) => {
      const svc = d.service || 'Autre';
      map[svc] = (map[svc] || 0) + Number(d.montant);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [depenses]);

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

  const effectifParCycle = useMemo(() => {
    const map: Record<string, number> = {};
    eleves.forEach((e: any) => {
      const cycle = e.classes?.niveaux?.cycles?.nom || 'Non affecté';
      map[cycle] = (map[cycle] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [eleves]);

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

  // ─── Indice de Rentabilité par service ──────────────────
  const SERVICE_LABELS: Record<string, string> = {
    scolarite: 'Scolarité', transport: 'Transport', cantine: 'Cantine',
    uniforme: 'Boutique', fournitures: 'Fournitures', autre: 'Autre',
  };
  const DEP_TO_PAI: Record<string, string> = {
    'Scolarité': 'scolarite', 'Transport': 'transport', 'Cantine': 'cantine',
    'Boutique': 'uniforme', 'Librairie': 'fournitures', 'Fonctionnement': 'autre', 'Autre': 'autre',
  };
  const SERVICES_PAI = ['scolarite', 'transport', 'cantine', 'uniforme', 'fournitures', 'autre'];
  const SERVICES_DEP = ['Transport', 'Cantine', 'Librairie', 'Boutique', 'Fonctionnement', 'Autre'];
  const allServices = [...new Set([...SERVICES_PAI.map(s => SERVICE_LABELS[s]), ...SERVICES_DEP])];

  const byService = useMemo(() => {
    return allServices.filter((_, i, arr) => arr.indexOf(arr[i]) === i).map(label => {
      const paiKey = Object.entries(SERVICE_LABELS).find(([, v]) => v === label)?.[0];
      const recettes = paiKey ? paiements.filter((p: any) => p.type_paiement === paiKey).reduce((sum: number, p: any) => sum + Number(p.montant), 0) : 0;
      const depKey = Object.entries(DEP_TO_PAI).find(([, v]) => v === paiKey)?.[0] || label;
      const dep = depenses.filter((d: any) => d.service === depKey).reduce((sum: number, d: any) => sum + Number(d.montant), 0);
      const ir = dep > 0 ? parseFloat((recettes / dep).toFixed(2)) : recettes > 0 ? 999 : 0;
      return { service: label, recettes, depenses: dep, ir, marge: recettes - dep };
    }).filter(s => s.recettes > 0 || s.depenses > 0);
  }, [paiements, depenses]);

  const soldeNet = totalRecettes - totalDepenses;
  const indiceRentabilite = totalDepenses > 0 ? (totalRecettes / totalDepenses).toFixed(2) : '∞';

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
        <Card className="overflow-hidden border border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Recettes du mois</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold text-amber-700 dark:text-amber-400 truncate">{totalRecettesMois.toLocaleString()} <span className="text-[10px] font-normal">GNF</span></div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{paiementsMois.length} paiements</p>
          </CardContent>
        </Card>
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

      {/* Family & Librairie KPIs */}
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
            <p className="text-[10px] text-muted-foreground mt-0.5">{impayesFamilles.length} familles</p>
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
        <Card className="overflow-hidden border border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-muted-foreground truncate">Enfants en fratrie</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Users className="h-4 w-4 text-cyan-600 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-cyan-700 dark:text-cyan-400">{enfantsEnFratrie}</div>
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

      {/* CA Comparatif Bar Chart: Scolarité/Transport vs Librairie/Options */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">📊 Chiffre d'Affaires comparatif</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const caTransport = paiements.filter((p: any) => p.type_paiement === 'transport').reduce((s: number, p: any) => s + Number(p.montant), 0);
            const caOptions = paiements.filter((p: any) => ['article', 'boutique', 'fournitures', 'uniforme', 'cantine'].includes(p.type_paiement)).reduce((s: number, p: any) => s + Number(p.montant), 0);
            const caInscription = paiements.filter((p: any) => ['inscription', 'reinscription'].includes(p.type_paiement)).reduce((s: number, p: any) => s + Number(p.montant), 0);
            const chartData = [
              { name: 'Scolarité', montant: caScolarite },
              { name: 'Transport', montant: caTransport },
              { name: 'Librairie', montant: caLibrairie },
              { name: 'Options/Boutique', montant: caOptions },
              { name: 'Inscriptions', montant: caInscription },
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
        <Card className={`border border-teal-200 dark:border-teal-800 shadow-sm bg-gradient-to-br from-teal-500/15 to-teal-500/5' : 'bg-gradient-to-br from-red-500/15 to-red-500/5'}`}>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalRecettes - totalDepenses >= 0 ? 'bg-teal-500/20' : 'bg-red-500/20'}`}>
              <Wallet className={`h-6 w-6 ${totalRecettes - totalDepenses >= 0 ? 'text-teal-600' : 'text-red-600'}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Solde net</p>
              <p className={`text-xl font-bold ${totalRecettes - totalDepenses >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'}`}>
                {(totalRecettes - totalDepenses).toLocaleString()} GNF
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
            {alertesCantine.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Élève</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead className="text-right">Solde</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertesCantine.slice(0, 10).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.nom}</TableCell>
                        <TableCell>{a.classe}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{a.solde.toLocaleString()} GNF</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {alertesCantine.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    … et {alertesCantine.length - 10} autre(s)
                  </p>
                )}
              </div>
            )}
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
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} GNF`]} />
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
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value.toLocaleString()} GNF`]} />
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
