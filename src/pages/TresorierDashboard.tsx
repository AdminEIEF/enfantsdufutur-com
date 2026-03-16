import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Banknote, CalendarCheck, Users, Loader2, BookOpen, GraduationCap, Wrench, Briefcase, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
    link: '/tresorier-salaires',
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
  const [paiements, setPaiements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [empRes, paiRes] = await Promise.all([
      supabase.from('employes').select('id, nom, prenom, poste, categorie, matricule, salaire_base, statut').eq('statut', 'actif'),
      supabase.from('paiements_tresorier').select('id, employe_id, montant, mois, annee').eq('mois', currentMonth).eq('annee', currentYear),
    ]);
    if (empRes.data) setEmployes(empRes.data);
    if (paiRes.data) setPaiements(paiRes.data);
    setLoading(false);
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isPaid = (empId: string) => paiements.some(p => p.employe_id === empId);

  const totalBudget = employes.reduce((s, e) => s + Number(e.salaire_base), 0);
  const totalPaye = employes.filter(e => isPaid(e.id)).reduce((s, e) => s + Number(e.salaire_base), 0);
  const soldeRestant = totalBudget - totalPaye;
  const nbPaye = employes.filter(e => isPaid(e.id)).length;
  const pctGlobal = employes.length > 0 ? Math.round((nbPaye / employes.length) * 100) : 0;

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
        <Button onClick={() => navigate('/tresorier-salaires')} className="bg-emerald-600 hover:bg-emerald-700">
          <Banknote className="h-4 w-4 mr-2" /> Gestion Salaires
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Banknote className="h-7 w-7 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget Total</p>
                <p className="text-lg font-bold truncate">{fmtNum(totalBudget)} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-7 w-7 text-blue-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Montant Payé</p>
                <p className="text-lg font-bold text-emerald-600 truncate">{fmtNum(totalPaye)} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${soldeRestant > 0 ? 'border-l-destructive' : 'border-l-emerald-500'}`}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-7 w-7 text-destructive shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Solde Restant</p>
                <p className={`text-lg font-bold truncate ${soldeRestant > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {fmtNum(soldeRestant)} GNF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-violet-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Employés payés</p>
                <p className="text-lg font-bold">{nbPaye} / {employes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progression globale */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Progression globale des paiements</p>
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
