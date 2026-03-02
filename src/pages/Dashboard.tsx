import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, CreditCard, BookOpen, GraduationCap, TrendingUp, Utensils, AlertTriangle, Wallet, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { DashboardImpayesSection } from '@/components/DashboardImpayesSection';
import { DashboardRecouvrementSection } from '@/components/DashboardRecouvrementSection';

export default function Dashboard() {
  const { roles } = useAuth();

  const { data: eleves = [] } = useQuery({
    queryKey: ['dashboard-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, statut, option_cantine, solde_cantine, classe_id, famille_id, created_at, classes(nom, niveau_id, niveaux:niveau_id(nom, frais_scolarite, cycles:cycle_id(nom)))')
        .is('deleted_at', null);
      if (error) throw error;
      return data;
    },
  });

  const { data: paiements = [] } = useQuery({
    queryKey: ['dashboard-paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('id, montant, type_paiement, date_paiement, canal, eleve_id')
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

  // ─── Ordre pédagogique des niveaux ──────────────────
  const NIVEAU_ORDRE = ['Crèche', 'TPS', 'PS', 'MS', 'GS', 'CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2', '7E', '8E', '9E', '10E', '11E', '12E', 'Terminale'];
  const getNiveauOrdre = (nom: string) => {
    const idx = NIVEAU_ORDRE.findIndex(n => nom.toUpperCase().includes(n.toUpperCase()));
    return idx >= 0 ? idx : 999;
  };

  // Impayés par famille
  const impayesFamilles = useMemo(() => {
    const familleIds = new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id));
    const result: { nom: string; reste: number; niveau: string }[] = [];
    familleIds.forEach(fid => {
      const kids = eleves.filter((e: any) => e.famille_id === fid);
      const fam = familles.find((f: any) => f.id === fid);
      const annuel = kids.reduce((s: number, e: any) => s + Number(e.classes?.niveaux?.frais_scolarite || 0), 0);
      const paye = kids.reduce((s: number, e: any) => s + paiements.filter((p: any) => p.eleve_id === e.id && p.type_paiement === 'scolarite').reduce((ss: number, p: any) => ss + Number(p.montant), 0), 0);
      const reste = annuel - paye;
      const niveaux = kids.map((e: any) => e.classes?.niveaux?.nom).filter(Boolean);
      const niveau = niveaux[0] || 'Non classé';
      if (reste > 0) result.push({ nom: fam?.nom_famille || 'Inconnue', reste, niveau });
    });
    return result.sort((a, b) => b.reste - a.reste);
  }, [eleves, paiements, familles]);

  // Group impayés by niveau
  const impayesParNiveau = useMemo(() => {
    const map: Record<string, typeof impayesFamilles> = {};
    impayesFamilles.forEach(f => {
      if (!map[f.niveau]) map[f.niveau] = [];
      map[f.niveau].push(f);
    });
    return Object.entries(map).sort(([a], [b]) => getNiveauOrdre(a) - getNiveauOrdre(b));
  }, [impayesFamilles]);

  const paiementsMois = paiements.filter((p: any) => p.date_paiement?.startsWith(thisMonth));
  const totalRecettesMois = paiementsMois.reduce((s: number, p: any) => s + Number(p.montant), 0);

  const depensesMois = depenses.filter((d: any) => d.date_depense?.startsWith(thisMonth));
  const totalDepensesMois = depensesMois.reduce((s: number, d: any) => s + Number(d.montant), 0);

  const cantineInscrits = eleves.filter((e: any) => e.option_cantine).length;
  const cantineSoldeFaible = eleves.filter((e: any) => e.option_cantine && Number(e.solde_cantine || 0) < 1000).length;

  // ─── Taux de recouvrement par classe ──────────────────
  const recouvrementParClasse = useMemo(() => {
    const classeMap: Record<string, { nom: string; niveauNom: string; totalAttendu: number; totalPaye: number; effectif: number }> = {};

    eleves.forEach((e: any) => {
      if (!e.classe_id || !e.classes) return;
      const classeNom = e.classes.nom;
      const niveauNom = e.classes.niveaux?.nom || 'Non classé';
      const totalAnnuel = Number(e.classes.niveaux?.frais_scolarite || 0);

      if (!classeMap[e.classe_id]) {
        classeMap[e.classe_id] = { nom: classeNom, niveauNom, totalAttendu: 0, totalPaye: 0, effectif: 0 };
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
      .sort((a, b) => getNiveauOrdre(a.niveauNom) - getNiveauOrdre(b.niveauNom) || a.nom.localeCompare(b.nom));
  }, [eleves, paiements]);

  // Group recouvrement by niveau
  const recouvrementParNiveau = useMemo(() => {
    const map: Record<string, typeof recouvrementParClasse> = {};
    recouvrementParClasse.forEach(c => {
      if (!map[c.niveauNom]) map[c.niveauNom] = [];
      map[c.niveauNom].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => getNiveauOrdre(a) - getNiveauOrdre(b));
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Inscriptions</CardTitle>
            <UserPlus className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">Nouvelles inscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Réinscriptions</CardTitle>
            <UserPlus className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReinscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">Réinscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recettes du mois</CardTitle>
            <CreditCard className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecettesMois.toLocaleString()} <span className="text-sm font-normal">GNF</span></div>
            <p className="text-xs text-muted-foreground mt-1">{paiementsMois.length} paiements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recouvrement</CardTitle>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tauxGlobal}%</div>
            <p className="text-xs text-muted-foreground mt-1">Taux global</p>
          </CardContent>
        </Card>
      </div>

      {/* Family & Librairie KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Impayés</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{impayesFamilles.reduce((s, f) => s + f.reste, 0).toLocaleString()} <span className="text-sm font-normal">GNF</span></div>
            <p className="text-xs text-muted-foreground mt-1">{impayesFamilles.length} familles concernées</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Familles inscrites</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFamilles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enfants en fratrie</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enfantsEnFratrie}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CA Scolarité</CardTitle>
            <CreditCard className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caScolarite.toLocaleString()} <span className="text-sm font-normal">GNF</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CA Librairie</CardTitle>
            <BookOpen className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caLibrairie.toLocaleString()} <span className="text-sm font-normal">GNF</span></div>
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
        <Card className="border-accent/30">
          <CardContent className="pt-6 flex items-center gap-4">
            <TrendingUp className="h-10 w-10 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Total recettes</p>
              <p className="text-xl font-bold">{totalRecettes.toLocaleString()} GNF</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6 flex items-center gap-4">
            <ArrowDownRight className="h-10 w-10 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Total dépenses</p>
              <p className="text-xl font-bold">{totalDepenses.toLocaleString()} GNF</p>
            </div>
          </CardContent>
        </Card>
        <Card className={totalRecettes - totalDepenses >= 0 ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}>
          <CardContent className="pt-6 flex items-center gap-4">
            <Wallet className={`h-10 w-10 ${totalRecettes - totalDepenses >= 0 ? 'text-accent' : 'text-destructive'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Solde net</p>
              <p className={`text-xl font-bold ${totalRecettes - totalDepenses >= 0 ? 'text-accent' : 'text-destructive'}`}>
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
