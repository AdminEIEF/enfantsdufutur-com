import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Banknote, CalendarCheck, Users, Loader2, BookOpen, GraduationCap, Wrench, Briefcase, TrendingUp, DollarSign, AlertTriangle, CheckCircle2, PiggyBank, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';

const CATEGORIES = [
  { value: 'enseignant_primaire', label: '👨‍🏫 Ens. Primaire' },
  { value: 'enseignant_secondaire', label: '👨‍🏫 Ens. Secondaire' },
  { value: 'administration', label: '🏢 Administration' },
  { value: 'service', label: '🔧 Service' },
  { value: 'direction', label: '👔 Direction' },
  { value: 'hygiene', label: '🧹 Hygiène' },
  { value: 'securite_primaire', label: '🛡️ Sécu. Primaire' },
  { value: 'securite_lycee', label: '🛡️ Sécu. Lycée' },
  { value: 'chauffeur', label: '🚗 Chauffeur' },
  { value: 'infirmiere', label: '🏥 Infirmière' },
  { value: 'librairie', label: '📚 Librairie' },
  { value: 'cantine', label: '🍽️ Cantine' },
  { value: 'surveillant', label: '👁️ Surveillant' },
];

const GROUPS = [
  {
    label: 'Enseignants Primaire',
    icon: GraduationCap,
    cats: ['enseignant_primaire'],
    color: 'text-blue-600',
    borderColor: 'border-l-blue-500',
    link: '/tresorier-salaires?mode=primaire',
  },
  {
    label: 'Enseignants Secondaire',
    icon: BookOpen,
    cats: ['enseignant_secondaire'],
    color: 'text-indigo-600',
    borderColor: 'border-l-indigo-500',
    link: '/tresorier-salaires?mode=secondaire',
  },
  {
    label: 'Administration & Direction',
    icon: Briefcase,
    cats: ['administration', 'direction', 'service'],
    color: 'text-purple-600',
    borderColor: 'border-l-purple-500',
    link: '/tresorier-salaires?mode=admin',
  },
  {
    label: 'Services de soutien',
    icon: Wrench,
    cats: ['hygiene', 'securite_primaire', 'securite_lycee', 'chauffeur', 'infirmiere', 'cantine', 'librairie', 'surveillant'],
    color: 'text-amber-600',
    borderColor: 'border-l-amber-500',
    link: '/tresorier-salaires?mode=soutien',
  },
];

const getEffectiveCat = (e: any) => e.categorie === 'enseignant'
  ? (e.matricule?.startsWith('ESC') ? 'enseignant_secondaire' : 'enseignant_primaire')
  : e.categorie;

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function TresorierDashboard() {
  const [employes, setEmployes] = useState<any[]>([]);
  const [paiementsSalaire, setPaiementsSalaire] = useState<any[]>([]);
  const [recettesMois, setRecettesMois] = useState(0);
  const [recettesTotal, setRecettesTotal] = useState(0);
  const [depensesAutresMois, setDepensesAutresMois] = useState(0);
  const [totalElevesInscrits, setTotalElevesInscrits] = useState(0);
  const [totalElevesPayesMois, setTotalElevesPayesMois] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const mStart = startOfMonth(now).toISOString();
    const mEnd = endOfMonth(now).toISOString();

    const [empRes, paiSalRes, recMoisRes, recTotalRes, depAutresRes, elevesRes, elevesPaidRes] = await Promise.all([
      supabase.from('employes').select('id, nom, prenom, poste, categorie, matricule, salaire_base, statut').eq('statut', 'actif'),
      supabase.from('paiements_tresorier').select('id, employe_id, montant, mois, annee').eq('mois', currentMonth).eq('annee', currentYear),
      // Recettes du mois (paiements scolarité + autres)
      supabase.from('paiements').select('montant').gte('date_paiement', mStart).lte('date_paiement', mEnd),
      // Recettes totales de l'année
      supabase.from('paiements').select('montant'),
      // Dépenses du mois (hors salaires, car on veut savoir ce qui reste après les autres charges)
      supabase.from('depenses').select('montant, service').eq('statut', 'validee').gte('date_depense', mStart).lte('date_depense', mEnd),
      // Total élèves inscrits
      supabase.from('eleves').select('id', { count: 'exact', head: true }).eq('statut', 'inscrit').is('deleted_at', null),
      // Élèves ayant payé ce mois
      supabase.from('paiements').select('eleve_id').eq('type_paiement', 'scolarite').gte('date_paiement', mStart).lte('date_paiement', mEnd),
    ]);

    if (empRes.data) setEmployes(empRes.data);
    if (paiSalRes.data) setPaiementsSalaire(paiSalRes.data);
    
    const recMois = (recMoisRes.data || []).reduce((s: number, p: any) => s + Number(p.montant), 0);
    setRecettesMois(recMois);
    
    const recTotal = (recTotalRes.data || []).reduce((s: number, p: any) => s + Number(p.montant), 0);
    setRecettesTotal(recTotal);

    // Dépenses du mois hors salaires
    const depAutres = (depAutresRes.data || []).filter((d: any) => d.service !== 'Salaires').reduce((s: number, d: any) => s + Number(d.montant), 0);
    setDepensesAutresMois(depAutres);

    setTotalElevesInscrits(elevesRes.count || 0);
    // Unique students who paid this month
    const uniquePaid = new Set((elevesPaidRes.data || []).map((p: any) => p.eleve_id));
    setTotalElevesPayesMois(uniquePaid.size);

    setLoading(false);
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isPaid = (empId: string) => paiementsSalaire.some(p => p.employe_id === empId);

  const totalBudgetSalaires = employes.reduce((s, e) => s + Number(e.salaire_base), 0);
  const totalSalairePaye = employes.filter(e => isPaid(e.id)).reduce((s, e) => s + Number(e.salaire_base), 0);
  const salaireRestantAPayer = totalBudgetSalaires - totalSalairePaye;
  const nbPaye = employes.filter(e => isPaid(e.id)).length;
  const pctGlobal = employes.length > 0 ? Math.round((nbPaye / employes.length) * 100) : 0;

  // Taux de recouvrement
  const tauxRecouvrement = totalElevesInscrits > 0 ? Math.round((totalElevesPayesMois / totalElevesInscrits) * 100) : 0;

  // Caisse disponible = Recettes du mois - Dépenses autres du mois
  const caisseDisponible = recettesMois - depensesAutresMois;
  
  // Après paiement salaires déjà effectués
  const caisseApresPayes = caisseDisponible - totalSalairePaye;
  
  // Si on payait tous les salaires restants
  const caisseApresTout = caisseDisponible - totalBudgetSalaires;
  
  // Peut-on payer tous les salaires ?
  const peutPayerTous = caisseDisponible >= totalBudgetSalaires;
  const peutPayerRestants = caisseApresPayes >= salaireRestantAPayer;

  // Per-category stats
  const categoryStats = CATEGORIES.map(cat => {
    const catEmp = employes.filter(e => getEffectiveCat(e) === cat.value);
    const catPaid = catEmp.filter(e => isPaid(e.id));
    const budget = catEmp.reduce((s, e) => s + Number(e.salaire_base), 0);
    const paye = catPaid.reduce((s, e) => s + Number(e.salaire_base), 0);
    return { ...cat, total: catEmp.length, paid: catPaid.length, budget, paye };
  });

  // Group stats
  const groupStats = GROUPS.map(g => {
    const gEmp = employes.filter(e => g.cats.includes(getEffectiveCat(e)));
    const gPaid = gEmp.filter(e => isPaid(e.id));
    const budget = gEmp.reduce((s, e) => s + Number(e.salaire_base), 0);
    const paye = gPaid.reduce((s, e) => s + Number(e.salaire_base), 0);
    const subCats = categoryStats.filter(c => g.cats.includes(c.value) && c.total > 0);
    return { ...g, total: gEmp.length, paid: gPaid.length, budget, paye, subCats };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Wallet className="h-7 w-7 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord — Trésorerie</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => navigate('/tresorier-salaires')} className="bg-emerald-600 hover:bg-emerald-700">
            <Banknote className="h-4 w-4 mr-2" /> Gestion Salaires
          </Button>
          <Button onClick={() => navigate('/tresorier-avances')} variant="outline">
            <Wallet className="h-4 w-4 mr-2" /> Avances
          </Button>
          <Button onClick={() => navigate('/tresorier-avances-soutien')} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50">
            <Wrench className="h-4 w-4 mr-2" /> Avances Soutien
          </Button>
        </div>
      </div>

      {/* === SECTION CAISSE & RECOUVREMENT === */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-blue-600" />
            État de la Caisse — {format(new Date(), 'MMMM yyyy', { locale: fr })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recettes et recouvrement */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-background rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recettes du mois</p>
              <p className="text-lg font-bold text-blue-600">{fmtNum(recettesMois)} GNF</p>
              <p className="text-[10px] text-muted-foreground">Tous paiements confondus</p>
            </div>
            <div className="bg-white dark:bg-background rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Taux de recouvrement</p>
              <p className="text-lg font-bold">{tauxRecouvrement}%</p>
              <p className="text-[10px] text-muted-foreground">{fmtNum(totalElevesPayesMois)}/{fmtNum(totalElevesInscrits)} élèves ce mois</p>
            </div>
            <div className="bg-white dark:bg-background rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Autres dépenses du mois</p>
              <p className="text-lg font-bold text-orange-600">{fmtNum(depensesAutresMois)} GNF</p>
              <p className="text-[10px] text-muted-foreground">Hors salaires</p>
            </div>
            <div className="bg-white dark:bg-background rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Caisse disponible</p>
              <p className={`text-lg font-bold ${caisseDisponible >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{fmtNum(caisseDisponible)} GNF</p>
              <p className="text-[10px] text-muted-foreground">Recettes - Dépenses autres</p>
            </div>
          </div>

          {/* Analyse : Caisse vs Salaires */}
          <div className="bg-white dark:bg-background rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Caisse vs Masse Salariale
              </h3>
              {peutPayerTous ? (
                <Badge className="bg-emerald-500 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Caisse suffisante</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Caisse insuffisante</Badge>
              )}
            </div>

            {/* Visual comparison */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Caisse disponible</span>
                <span className="font-mono font-bold text-emerald-600">{fmtNum(caisseDisponible)} GNF</span>
              </div>
              <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all" 
                  style={{ width: `${totalBudgetSalaires > 0 ? Math.min((caisseDisponible / totalBudgetSalaires) * 100, 100) : 0}%` }} />
                <div className="absolute inset-y-0 left-0 border-r-2 border-destructive" 
                  style={{ width: `${totalBudgetSalaires > 0 ? Math.min(100, 100) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Masse salariale totale</span>
                <span className="font-mono font-bold text-destructive">{fmtNum(totalBudgetSalaires)} GNF</span>
              </div>
            </div>

            {/* Résumé après paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-[10px] text-muted-foreground">Salaires déjà payés</p>
                <p className="text-sm font-bold text-emerald-600">{fmtNum(totalSalairePaye)} GNF</p>
                <p className="text-[10px] text-muted-foreground">{nbPaye} employé(s)</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                <p className="text-[10px] text-muted-foreground">Salaires restants à payer</p>
                <p className="text-sm font-bold text-orange-600">{fmtNum(salaireRestantAPayer)} GNF</p>
                <p className="text-[10px] text-muted-foreground">{employes.length - nbPaye} employé(s)</p>
              </div>
              <div className={`text-center p-2 rounded-lg ${caisseApresTout >= 0 ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                <p className="text-[10px] text-muted-foreground">Reste en caisse après salaires</p>
                <p className={`text-sm font-bold ${caisseApresTout >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
                  {caisseApresTout >= 0 ? '' : '- '}{fmtNum(Math.abs(caisseApresTout))} GNF
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {caisseApresTout >= 0 ? '✅ Excédent' : '⚠️ Déficit'}
                </p>
              </div>
            </div>

            {!peutPayerRestants && salaireRestantAPayer > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive">Attention : Fonds insuffisants</p>
                  <p className="text-muted-foreground">
                    Il manque <strong className="text-destructive">{fmtNum(salaireRestantAPayer - caisseApresPayes)} GNF</strong> pour payer 
                    les {employes.length - nbPaye} employé(s) restant(s). 
                    Augmentez le recouvrement (actuellement {tauxRecouvrement}%) ou priorisez les paiements.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Salaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Banknote className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Masse Salariale</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 truncate">{fmtNum(totalBudgetSalaires)} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <CalendarCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Montant Payé</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400 truncate">{fmtNum(totalSalairePaye)} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`overflow-hidden border shadow-sm ${salaireRestantAPayer > 0 ? 'border-red-200 dark:border-red-800 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent' : 'border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${salaireRestantAPayer > 0 ? 'bg-red-500/15' : 'bg-emerald-500/15'}`}>
                <TrendingUp className={`h-5 w-5 ${salaireRestantAPayer > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Restant à payer</p>
                <p className={`text-lg font-bold truncate ${salaireRestantAPayer > 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {fmtNum(salaireRestantAPayer)} GNF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Employés payés</p>
                <p className="text-lg font-bold text-violet-700 dark:text-violet-400">{nbPaye} / {employes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progression globale */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Progression globale des paiements salaires</p>
            <Badge variant={pctGlobal === 100 ? 'default' : 'secondary'}>{pctGlobal}%</Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${pctGlobal}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {nbPaye === employes.length
              ? '✅ Tous les employés ont été payés ce mois-ci.'
              : `${employes.length - nbPaye} employé(s) en attente de paiement.`}
          </p>
        </CardContent>
      </Card>

      {/* Grouped sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groupStats.map(g => (
          <Card key={g.label} className={`border-l-4 ${g.borderColor}`}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <g.icon className={`h-5 w-5 ${g.color}`} />
                  {g.label}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => navigate(g.link)}>
                  Voir détail →
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Group KPIs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">Effectif</p>
                  <p className="text-base font-bold">{g.total}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">Budget</p>
                  <p className="text-base font-bold">{fmtNum(g.budget)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">Payé</p>
                  <p className="text-base font-bold text-emerald-600">{fmtNum(g.paye)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{g.paid}/{g.total} payé(s)</span>
                  <span className="font-medium">{g.total > 0 ? Math.round((g.paid / g.total) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${g.total > 0 ? (g.paid / g.total) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Sub-categories */}
              {g.subCats.length > 1 && (
                <div className="space-y-1.5 border-t pt-2">
                  {g.subCats.map(sc => (
                    <div key={sc.value} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{sc.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px]">{fmtNum(sc.budget)} GNF</span>
                        <Badge variant={sc.paid === sc.total && sc.total > 0 ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {sc.paid}/{sc.total}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* All categories detail grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Détail par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {categoryStats.filter(c => c.total > 0).map(cs => (
              <div key={cs.value} className="border rounded-lg p-2.5 text-center">
                <p className="text-[11px] font-medium text-muted-foreground mb-1 truncate">{cs.label}</p>
                <p className="text-sm font-bold">
                  <span className="text-emerald-600">{cs.paid}</span>
                  <span className="text-muted-foreground"> / {cs.total}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtNum(cs.budget)} GNF</p>
                <div className="w-full bg-muted rounded-full h-1 mt-1.5">
                  <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${cs.total > 0 ? (cs.paid / cs.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
