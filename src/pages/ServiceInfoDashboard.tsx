import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Users, Award, Video, Clock, CalendarDays, BarChart3, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ServiceInfoDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['service-info-dashboard'],
    queryFn: async () => {
      const [elevesRes, classesRes, matieresRes, coursRes, devoirsRes, bulletinsRes, edtRes] = await Promise.all([
        supabase.from('eleves').select('id', { count: 'exact', head: true }).eq('statut', 'inscrit').is('deleted_at', null),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('matieres').select('id', { count: 'exact', head: true }),
        supabase.from('cours').select('id', { count: 'exact', head: true }).eq('visible', true),
        supabase.from('devoirs').select('id', { count: 'exact', head: true }),
        supabase.from('bulletin_publications').select('id', { count: 'exact', head: true }).eq('visible_parent', true),
        supabase.from('emploi_du_temps').select('id', { count: 'exact', head: true }),
      ]);
      return {
        eleves: elevesRes.count || 0,
        classes: classesRes.count || 0,
        matieres: matieresRes.count || 0,
        cours: coursRes.count || 0,
        devoirs: devoirsRes.count || 0,
        bulletins: bulletinsRes.count || 0,
        edt: edtRes.count || 0,
      };
    },
  });

  const shortcuts = [
    { label: 'Mes Classes', icon: Users, path: '/mes-classes', color: 'text-blue-600 bg-blue-100' },
    { label: 'Saisie des notes', icon: BookOpen, path: '/notes', color: 'text-indigo-600 bg-indigo-100' },
    { label: 'Bulletins', icon: Award, path: '/bulletins', color: 'text-amber-600 bg-amber-100' },
    { label: 'Cours & Devoirs', icon: Video, path: '/cours-admin', color: 'text-purple-600 bg-purple-100' },
    { label: 'Emploi du temps', icon: Clock, path: '/emploi-du-temps', color: 'text-teal-600 bg-teal-100' },
    { label: 'Calendrier', icon: CalendarDays, path: '/calendrier', color: 'text-rose-600 bg-rose-100' },
    { label: 'Orientation', icon: BarChart3, path: '/orientation', color: 'text-cyan-600 bg-cyan-100' },
    { label: 'Performance', icon: FileText, path: '/performance', color: 'text-emerald-600 bg-emerald-100' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord — Service Informatique</h1>
        <p className="text-sm text-muted-foreground">Gestion académique et pédagogique</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-1 text-blue-500" />
            <div className="text-2xl font-bold">{stats?.eleves}</div>
            <p className="text-xs text-muted-foreground">Élèves inscrits</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <BookOpen className="h-6 w-6 mx-auto mb-1 text-indigo-500" />
            <div className="text-2xl font-bold">{stats?.classes}</div>
            <p className="text-xs text-muted-foreground">Classes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Video className="h-6 w-6 mx-auto mb-1 text-purple-500" />
            <div className="text-2xl font-bold">{stats?.cours}</div>
            <p className="text-xs text-muted-foreground">Cours publiés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Award className="h-6 w-6 mx-auto mb-1 text-amber-500" />
            <div className="text-2xl font-bold">{stats?.bulletins}</div>
            <p className="text-xs text-muted-foreground">Bulletins publiés</p>
          </CardContent>
        </Card>
      </div>

      {/* Raccourcis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Accès rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {shortcuts.map((s) => (
              <button
                key={s.path}
                onClick={() => navigate(s.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:shadow-md transition-all hover:scale-[1.02]"
              >
                <div className={`p-3 rounded-full ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-center">{s.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
