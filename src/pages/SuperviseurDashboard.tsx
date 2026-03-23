import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, RefreshCw, FileText, Briefcase, Loader2 } from 'lucide-react';

export default function SuperviseurDashboard() {
  const [stats, setStats] = useState({
    inscrits: 0,
    preInscrits: 0,
    reinscrits: 0,
    totalEmployes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const [elevesRes, preInsRes, employesRes] = await Promise.all([
        supabase.from('eleves').select('statut', { count: 'exact', head: false }).is('deleted_at', null),
        supabase.from('pre_inscriptions').select('id', { count: 'exact', head: true }),
        supabase.from('employes').select('id', { count: 'exact', head: true }).eq('statut', 'actif'),
      ]);

      const eleves = elevesRes.data || [];
      const inscrits = eleves.filter(e => e.statut === 'inscrit').length;
      const reinscrits = eleves.filter(e => e.statut === 'reinscrit').length;

      setStats({
        inscrits,
        preInscrits: preInsRes.count || 0,
        reinscrits,
        totalEmployes: employesRes.count || 0,
      });
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

  const cards = [
    { label: 'Élèves inscrits', value: stats.inscrits, icon: Users, color: 'text-blue-600', borderColor: 'border-blue-200 dark:border-blue-800', gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', iconBg: 'bg-blue-500/15' },
    { label: 'Pré-inscriptions', value: stats.preInscrits, icon: FileText, color: 'text-amber-600', borderColor: 'border-amber-200 dark:border-amber-800', gradient: 'from-amber-500/10 via-amber-500/5 to-transparent', iconBg: 'bg-amber-500/15' },
    { label: 'Réinscriptions', value: stats.reinscrits, icon: RefreshCw, color: 'text-emerald-600', borderColor: 'border-emerald-200 dark:border-emerald-800', gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent', iconBg: 'bg-emerald-500/15' },
    { label: 'Personnel actif', value: stats.totalEmployes, icon: Briefcase, color: 'text-purple-600', borderColor: 'border-purple-200 dark:border-purple-800', gradient: 'from-purple-500/10 via-purple-500/5 to-transparent', iconBg: 'bg-purple-500/15' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord — Superviseur</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble de l'établissement</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className={`overflow-hidden border ${c.borderColor} bg-gradient-to-br ${c.gradient} shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                  <c.icon className={`h-6 w-6 ${c.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accès rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/personnel'}>
              <Briefcase className="h-3 w-3 mr-1" /> Personnel
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/supervision'}>
              <Users className="h-3 w-3 mr-1" /> Supervision
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/pre-inscriptions'}>
              <FileText className="h-3 w-3 mr-1" /> Pré-inscriptions
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = '/configuration'}>
              <UserPlus className="h-3 w-3 mr-1" /> Configuration
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
