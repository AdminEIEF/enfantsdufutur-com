import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, RefreshCw, FileText, Briefcase, Loader2, GraduationCap, School, Building2, DollarSign, ShieldCheck, BookOpen, Baby, Flower2 } from 'lucide-react';
import SuperviseurPasswordPanel from '@/components/SuperviseurPasswordPanel';

interface CycleStats {
  cycle: string;
  niveau: string;
  count: number;
}

interface EmployeCategorie {
  categorie: string;
  count: number;
}

export default function SuperviseurDashboard() {
  const [stats, setStats] = useState({
    inscrits: 0,
    preInscrits: 0,
    reinscrits: 0,
    totalEmployes: 0,
    totalFamilles: 0,
    totalPaiements: 0,
    totalEleves: 0,
    totalNotes: 0,
    totalDepenses: 0,
    totalCompositions: 0,
    totalConnectes: 0,
  });
  const [cycleStats, setCycleStats] = useState<CycleStats[]>([]);
  const [employeCategories, setEmployeCategories] = useState<EmployeCategorie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const [elevesRes, preInsRes, employesRes, famillesRes, paiementsRes, notesRes, depensesRes, composRes, connectesRes] = await Promise.all([
        supabase.from('eleves').select('statut, classe_id, classes!inner(niveau_id, nom, niveaux!inner(nom, ordre, cycle_id, cycles!inner(nom, ordre)))').is('deleted_at', null),
        supabase.from('pre_inscriptions').select('id, statut', { count: 'exact', head: false }),
        supabase.from('employes').select('id, categorie').eq('statut', 'actif'),
        supabase.from('familles').select('id', { count: 'exact', head: true }),
        supabase.from('paiements').select('montant'),
        supabase.from('notes').select('id', { count: 'exact', head: true }),
        supabase.from('depenses').select('montant, statut'),
        supabase.from('compositions').select('id', { count: 'exact', head: true }),
        supabase.from('active_connections').select('id', { count: 'exact', head: true }),
      ]);

      const eleves = elevesRes.data || [];
      const inscrits = eleves.filter(e => e.statut === 'inscrit').length;
      const reinscrits = eleves.filter(e => e.statut === 'reinscrit').length;

      // Cycle stats by grouping
      const cycleMap = new Map<string, number>();
      eleves.forEach((e: any) => {
        const cycleName = e.classes?.niveaux?.cycles?.nom || 'Inconnu';
        const niveauName = e.classes?.niveaux?.nom || 'Inconnu';
        const key = `${cycleName}||${niveauName}`;
        cycleMap.set(key, (cycleMap.get(key) || 0) + 1);
      });
      const cycleArr: CycleStats[] = [];
      cycleMap.forEach((count, key) => {
        const [cycle, niveau] = key.split('||');
        cycleArr.push({ cycle, niveau, count });
      });

      // Employee categories
      const catMap = new Map<string, number>();
      (employesRes.data || []).forEach((emp: any) => {
        const cat = emp.categorie || 'autre';
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      });
      const catArr: EmployeCategorie[] = [];
      catMap.forEach((count, categorie) => catArr.push({ categorie, count }));
      catArr.sort((a, b) => b.count - a.count);

      const totalPaiements = (paiementsRes.data || []).reduce((s: number, p: any) => s + (p.montant || 0), 0);
      const preInscritsEnAttente = (preInsRes.data || []).filter((p: any) => p.statut === 'en_attente').length;
      const totalDepensesValidees = (depensesRes.data || []).filter((d: any) => d.statut === 'validee').reduce((s: number, d: any) => s + (d.montant || 0), 0);

      setStats({
        inscrits,
        preInscrits: preInscritsEnAttente,
        reinscrits,
        totalEmployes: (employesRes.data || []).length,
        totalFamilles: famillesRes.count || 0,
        totalPaiements,
        totalEleves: eleves.length,
        totalNotes: notesRes.count || 0,
        totalDepenses: totalDepensesValidees,
        totalCompositions: composRes.count || 0,
        totalConnectes: connectesRes.count || 0,
      });
      setCycleStats(cycleArr);
      setEmployeCategories(catArr);
      setLoading(false);
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const topCards = [
    { label: 'Total élèves', value: stats.totalEleves, icon: GraduationCap, color: 'text-blue-600', borderColor: 'border-blue-200 dark:border-blue-800', gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', iconBg: 'bg-blue-500/15' },
    { label: 'Familles', value: stats.totalFamilles, icon: Users, color: 'text-indigo-600', borderColor: 'border-indigo-200 dark:border-indigo-800', gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent', iconBg: 'bg-indigo-500/15' },
    { label: 'Personnel actif', value: stats.totalEmployes, icon: Briefcase, color: 'text-purple-600', borderColor: 'border-purple-200 dark:border-purple-800', gradient: 'from-purple-500/10 via-purple-500/5 to-transparent', iconBg: 'bg-purple-500/15' },
    { label: 'Pré-inscriptions', value: stats.preInscrits, icon: FileText, color: 'text-amber-600', borderColor: 'border-amber-200 dark:border-amber-800', gradient: 'from-amber-500/10 via-amber-500/5 to-transparent', iconBg: 'bg-amber-500/15' },
  ];

  const statusCards = [
    { label: 'Inscrits', value: stats.inscrits, icon: UserPlus, color: 'text-green-600', borderColor: 'border-green-200 dark:border-green-800', gradient: 'from-green-500/10 via-green-500/5 to-transparent', iconBg: 'bg-green-500/15' },
    { label: 'Réinscrits', value: stats.reinscrits, icon: RefreshCw, color: 'text-emerald-600', borderColor: 'border-emerald-200 dark:border-emerald-800', gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent', iconBg: 'bg-emerald-500/15' },
    { label: 'Paiements totaux', value: `${stats.totalPaiements.toLocaleString('fr-FR')} F`, icon: DollarSign, color: 'text-teal-600', borderColor: 'border-teal-200 dark:border-teal-800', gradient: 'from-teal-500/10 via-teal-500/5 to-transparent', iconBg: 'bg-teal-500/15' },
  ];

  const cycleOrder = ['Crèche', 'Maternelle', 'Primaire', 'Collège', 'Lycée'];
  const cycleIcons: Record<string, any> = {
    'Crèche': Baby,
    'Maternelle': Flower2,
    'Primaire': School,
    'Collège': Building2,
    'Lycée': GraduationCap,
  };
  const cycleColors: Record<string, string> = {
    'Crèche': 'text-pink-600',
    'Maternelle': 'text-orange-600',
    'Primaire': 'text-blue-600',
    'Collège': 'text-indigo-600',
    'Lycée': 'text-purple-600',
  };

  const groupedCycles = cycleOrder.map(cycleName => {
    const items = cycleStats.filter(s => s.cycle === cycleName);
    const total = items.reduce((s, i) => s + i.count, 0);
    return { cycleName, items, total };
  }).filter(g => g.total > 0);

  const categorieLabelMap: Record<string, string> = {
    enseignant: 'Enseignants',
    administration: 'Administration',
    direction: 'Direction',
    hygiene: 'Hygiène',
    securite_primaire: 'Sécurité Primaire',
    securite_lycee: 'Sécurité Lycée',
    chauffeur: 'Chauffeurs',
    cantine: 'Cantine',
    librairie: 'Librairie',
    infirmiere: 'Infirmière',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord — Superviseur</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble en temps réel de l'établissement</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((c) => (
          <Card key={c.label} className={`overflow-hidden border ${c.borderColor} bg-gradient-to-br ${c.gradient} shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status + Finance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statusCards.map((c) => (
          <Card key={c.label} className={`overflow-hidden border ${c.borderColor} bg-gradient-to-br ${c.gradient} shadow-sm`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Effectifs par cycle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Effectifs par cycle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {groupedCycles.map(({ cycleName, items, total }) => {
              const CycleIcon = cycleIcons[cycleName] || School;
              const color = cycleColors[cycleName] || 'text-gray-600';
              return (
                <div key={cycleName} className="border rounded-xl p-4 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CycleIcon className={`h-4 w-4 ${color}`} />
                      <span className={`font-semibold text-sm ${color}`}>{cycleName}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-bold">{total}</Badge>
                  </div>
                  {items.map(item => (
                    <div key={item.niveau} className="flex justify-between text-xs text-muted-foreground pl-6">
                      <span>{item.niveau}</span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Personnel par catégorie */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Personnel par catégorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {employeCategories.map(({ categorie, count }) => (
              <div key={categorie} className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30">
                <span className="text-sm">{categorieLabelMap[categorie] || categorie}</span>
                <Badge variant="outline" className="font-bold">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SuperviseurPasswordPanel />

      {/* Accès rapides */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Accès rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/personnel'}>
              <Briefcase className="h-3 w-3 mr-1" /> Personnel
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/supervision'}>
              <ShieldCheck className="h-3 w-3 mr-1" /> Supervision
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/pre-inscriptions'}>
              <FileText className="h-3 w-3 mr-1" /> Pré-inscriptions
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/configuration'}>
              <UserPlus className="h-3 w-3 mr-1" /> Configuration
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/compositions-admin'}>
              <BookOpen className="h-3 w-3 mr-1" /> Compositions
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
