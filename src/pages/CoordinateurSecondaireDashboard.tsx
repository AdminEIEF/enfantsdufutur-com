import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, ClipboardList, GraduationCap, TrendingUp, Timer, CalendarRange, ChartColumnStacked, BriefcaseBusiness } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export default function CoordinateurSecondaireDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEnseignants: 0,
    actifs: 0,
    affectes: 0,
    nonAffectes: 0,
    totalClasses: 0,
    totalEleves: 0,
    elevesCollege: 0,
    elevesLycee: 0,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Fetch secondary teachers
      const { data: emps } = await supabase
        .from('employes')
        .select('id, matricule, statut, enseignant_classes(id)')
        .eq('categorie', 'enseignant');

      const secondary = (emps || []).filter((e: any) => e.matricule?.startsWith('ESC'));
      const actifs = secondary.filter((e: any) => e.statut === 'actif');
      const affectes = secondary.filter((e: any) => e.enseignant_classes && e.enseignant_classes.length > 0);

      // Fetch secondary classes
      const { data: classes } = await supabase
        .from('classes')
        .select('id, niveaux(cycles(nom))');
      const secClasses = (classes || []).filter((c: any) => {
        const cycle = c.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycle.includes('secondaire') || cycle.includes('collège') || cycle.includes('lycée');
      });

      // Fetch secondary students count
      const { data: eleves } = await supabase
        .from('eleves')
        .select('id, classe_id, classes(niveaux(cycles(nom)))')
        .is('deleted_at', null);
      const secEleves = (eleves || []).filter((e: any) => {
        const cycle = e.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycle.includes('secondaire') || cycle.includes('collège') || cycle.includes('lycée');
      });
      const elevesCollege = secEleves.filter((e: any) => {
        const cycle = e.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycle.includes('collège');
      }).length;
      const elevesLycee = secEleves.filter((e: any) => {
        const cycle = e.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycle.includes('lycée');
      }).length;

      setStats({
        totalEnseignants: secondary.length,
        actifs: actifs.length,
        affectes: affectes.length,
        nonAffectes: secondary.length - affectes.length,
        totalClasses: secClasses.length,
        totalEleves: secEleves.length,
        elevesCollege,
        elevesLycee,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: 'Élèves Secondaire', value: stats.totalEleves, icon: GraduationCap, color: 'text-purple-600', borderColor: 'border-purple-200 dark:border-purple-800', gradient: 'from-purple-500/10 via-purple-500/5 to-transparent', iconBg: 'bg-purple-500/15', onClick: () => navigate('/coordinateur-secondaire-eleves'), subtitle: `${stats.elevesCollege} Collège · ${stats.elevesLycee} Lycée` },
    { label: 'Enseignants', value: stats.totalEnseignants, icon: Users, color: 'text-blue-600', borderColor: 'border-blue-200 dark:border-blue-800', gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', iconBg: 'bg-blue-500/15', onClick: () => navigate('/coordinateur-secondaire-personnel') },
    { label: 'Actifs', value: stats.actifs, icon: TrendingUp, color: 'text-emerald-600', borderColor: 'border-emerald-200 dark:border-emerald-800', gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent', iconBg: 'bg-emerald-500/15' },
    { label: 'Affectés', value: stats.affectes, icon: ClipboardList, color: 'text-teal-600', borderColor: 'border-teal-200 dark:border-teal-800', gradient: 'from-teal-500/10 via-teal-500/5 to-transparent', iconBg: 'bg-teal-500/15' },
    { label: 'Non affectés', value: stats.nonAffectes, icon: Users, color: 'text-red-600', borderColor: 'border-red-200 dark:border-red-800', gradient: 'from-red-500/10 via-red-500/5 to-transparent', iconBg: 'bg-red-500/15' },
    { label: 'Classes', value: stats.totalClasses, icon: BookOpen, color: 'text-indigo-600', borderColor: 'border-indigo-200 dark:border-indigo-800', gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent', iconBg: 'bg-indigo-500/15' },
  ];

  const quickActions = [
    { label: 'Élèves Secondaire', icon: GraduationCap, link: '/coordinateur-secondaire-eleves' },
    { label: 'Personnel Secondaire', icon: BriefcaseBusiness, link: '/coordinateur-secondaire-personnel' },
    { label: 'Mes Classes', icon: Users, link: '/mes-classes' },
    { label: 'Saisie des notes', icon: BookOpen, link: '/notes' },
    { label: 'Cours & Devoirs', icon: ClipboardList, link: '/cours-admin' },
    { label: 'Emploi du temps', icon: Timer, link: '/emploi-du-temps' },
    { label: 'Calendrier', icon: CalendarRange, link: '/calendrier' },
    { label: 'Orientation', icon: ChartColumnStacked, link: '/orientation' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coordination Secondaire</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble du cycle secondaire</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c, i) => (
          <Card
            key={i}
            className={`overflow-hidden border ${c.borderColor} bg-gradient-to-br ${c.gradient} shadow-sm hover:shadow-md transition-shadow ${c.onClick ? 'cursor-pointer' : ''}`}
            onClick={c.onClick}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accès rapides */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Accès rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="justify-start text-xs h-9"
                onClick={() => navigate(action.link)}
              >
                <action.icon className="h-3.5 w-3.5 mr-1.5" />
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
