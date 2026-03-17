import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Users, BookOpen, ClipboardList, GraduationCap, TrendingUp } from 'lucide-react';
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

      setStats({
        totalEnseignants: secondary.length,
        actifs: actifs.length,
        affectes: affectes.length,
        nonAffectes: secondary.length - affectes.length,
        totalClasses: secClasses.length,
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
    { label: 'Enseignants Secondaire', value: stats.totalEnseignants, icon: Users, color: 'text-primary', onClick: () => navigate('/coordinateur-secondaire-personnel') },
    { label: 'Actifs', value: stats.actifs, icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Affectés', value: stats.affectes, icon: ClipboardList, color: 'text-emerald-600' },
    { label: 'Non affectés', value: stats.nonAffectes, icon: GraduationCap, color: 'text-destructive' },
    { label: 'Classes Secondaire', value: stats.totalClasses, icon: BookOpen, color: 'text-blue-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coordination Secondaire</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble du cycle secondaire</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c, i) => (
          <Card
            key={i}
            className={c.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
            onClick={c.onClick}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <c.icon className={`h-8 w-8 ${c.color}`} />
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
