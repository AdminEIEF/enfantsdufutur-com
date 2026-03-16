import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Banknote, CalendarCheck, Users, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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

  const categoryStats = CATEGORIES.map(cat => {
    const catEmp = employes.filter(e => e.categorie === cat.value);
    const catPaid = catEmp.filter(e => isPaid(e.id));
    return { label: cat.label, total: catEmp.length, paid: catPaid.length };
  }).filter(c => c.total > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-bold">Tableau de bord — Trésorerie</h1>
        </div>
        <Button onClick={() => navigate('/tresorier-salaires')} className="bg-emerald-600 hover:bg-emerald-700">
          <Banknote className="h-4 w-4 mr-2" /> Gestion Salaires
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Banknote className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Budget Réel</p>
                <p className="text-xl font-bold">{fmtNum(totalBudget)} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Montant Payé</p>
                <p className="text-xl font-bold text-emerald-600">{fmtNum(totalPaye)} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${soldeRestant > 0 ? 'border-l-destructive' : 'border-l-emerald-500'}`}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde Restant</p>
                <p className={`text-xl font-bold ${soldeRestant > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {fmtNum(soldeRestant)} GNF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-violet-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Employés payés</p>
                <p className="text-xl font-bold">{nbPaye} / {employes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-category breakdown */}
      {categoryStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categoryStats.map(cs => (
            <Card key={cs.label} className="border">
              <CardContent className="pt-4 pb-3 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">{cs.label}</p>
                <p className="text-lg font-bold">
                  <span className="text-emerald-600">{cs.paid}</span>
                  <span className="text-muted-foreground"> / {cs.total}</span>
                </p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${cs.total > 0 ? (cs.paid / cs.total) * 100 : 0}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progress global */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Progression globale des paiements</p>
            <Badge variant={nbPaye === employes.length ? 'default' : 'secondary'}>
              {employes.length > 0 ? Math.round((nbPaye / employes.length) * 100) : 0}%
            </Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${employes.length > 0 ? (nbPaye / employes.length) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {nbPaye === employes.length
              ? '✅ Tous les employés ont été payés ce mois-ci.'
              : `${employes.length - nbPaye} employé(s) en attente de paiement.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
