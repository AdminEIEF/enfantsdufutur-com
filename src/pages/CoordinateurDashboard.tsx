import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, BookOpen, ClipboardList, Calendar, Clock,
  CheckCircle2, AlertCircle, TrendingUp, GraduationCap, Award
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface DashboardStats {
  totalEleves: number;
  elevesMaternelle: number;
  elevesPrimaire: number;
  totalDocuments: number;
  documentsComplets: number;
  documentsManquants: number;
  totalCours: number;
  totalDevoirs: number;
  devoirsEnCours: number;
  totalSeances: number;
  evenementsAVenir: number;
  bulletinsPublies: number;
}

export default function CoordinateurDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalEleves: 0, elevesMaternelle: 0, elevesPrimaire: 0,
    totalDocuments: 0, documentsComplets: 0, documentsManquants: 0,
    totalCours: 0, totalDevoirs: 0, devoirsEnCours: 0,
    totalSeances: 0, evenementsAVenir: 0, bulletinsPublies: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Élèves (Maternelle + Primaire via coordinateur_eleves)
      const { data: coordEleves } = await supabase
        .from('coordinateur_eleves')
        .select('id, niveau_scolaire, statut');

      const totalEleves = coordEleves?.length || 0;
      const elevesMaternelle = coordEleves?.filter(e =>
        e.niveau_scolaire?.toLowerCase().includes('maternelle') ||
        e.niveau_scolaire?.toLowerCase().includes('crèche') ||
        e.niveau_scolaire?.toLowerCase().includes('ps') ||
        e.niveau_scolaire?.toLowerCase().includes('ms') ||
        e.niveau_scolaire?.toLowerCase().includes('gs')
      ).length || 0;
      const elevesPrimaire = totalEleves - elevesMaternelle;

      // Documents
      const { data: documents } = await supabase
        .from('coordinateur_documents')
        .select('id, statut, created_at, type_document, eleve_id');

      const totalDocuments = documents?.length || 0;
      const documentsComplets = documents?.filter(d => d.statut === 'depose').length || 0;
      const documentsManquants = documents?.filter(d => d.statut === 'manquant').length || 0;

      // Cours
      const { data: cours } = await supabase.from('cours').select('id', { count: 'exact' });
      const totalCours = cours?.length || 0;

      // Devoirs
      const { data: devoirs } = await supabase.from('devoirs').select('id, date_limite');
      const totalDevoirs = devoirs?.length || 0;
      const now = new Date().toISOString();
      const devoirsEnCours = devoirs?.filter(d => d.date_limite >= now.split('T')[0]).length || 0;

      // Emploi du temps
      const { data: seances } = await supabase.from('emploi_du_temps').select('id', { count: 'exact' });
      const totalSeances = seances?.length || 0;

      // Événements à venir
      const today = new Date().toISOString().split('T')[0];
      const { data: evenements } = await supabase
        .from('evenements_calendrier')
        .select('id')
        .gte('date_debut', today);
      const evenementsAVenir = evenements?.length || 0;

      // Bulletins publiés
      const { data: bulletins } = await supabase
        .from('bulletin_publications')
        .select('id')
        .eq('visible_parent', true);
      const bulletinsPublies = bulletins?.length || 0;

      // Derniers documents
      const { data: recentDocs } = await supabase
        .from('coordinateur_documents')
        .select('*, coordinateur_eleves(nom, prenom)')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentDocuments(recentDocs || []);

      setStats({
        totalEleves, elevesMaternelle, elevesPrimaire,
        totalDocuments, documentsComplets, documentsManquants,
        totalCours, totalDevoirs, devoirsEnCours,
        totalSeances, evenementsAVenir, bulletinsPublies,
      });
    } catch (err) {
      console.error('Erreur chargement stats coordinateur:', err);
    } finally {
      setLoading(false);
    }
  };

  const tauxCompletion = stats.totalDocuments > 0
    ? Math.round((stats.documentsComplets / stats.totalDocuments) * 100)
    : 0;

  const statCards = [
    {
      title: 'Élèves suivis',
      value: stats.totalEleves,
      subtitle: `${stats.elevesMaternelle} Maternelle · ${stats.elevesPrimaire} Primaire`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/coordinateur-eleves',
    },
    {
      title: 'Documents',
      value: stats.totalDocuments,
      subtitle: `${stats.documentsComplets} déposés · ${stats.documentsManquants} manquants`,
      icon: FileText,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      link: '/coordinateur-documents',
    },
    {
      title: 'Cours publiés',
      value: stats.totalCours,
      subtitle: 'Maternelle & Primaire',
      icon: BookOpen,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/cours-admin',
    },
    {
      title: 'Devoirs',
      value: stats.totalDevoirs,
      subtitle: `${stats.devoirsEnCours} en cours`,
      icon: ClipboardList,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      link: '/cours-admin',
    },
    {
      title: 'Séances planifiées',
      value: stats.totalSeances,
      subtitle: "Emploi du temps",
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      link: '/emploi-du-temps',
    },
    {
      title: 'Événements à venir',
      value: stats.evenementsAVenir,
      subtitle: 'Calendrier scolaire',
      icon: Calendar,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
      link: '/calendrier',
    },
  ];

  const quickActions = [
    { label: 'Gérer les élèves', icon: Users, link: '/coordinateur-eleves' },
    { label: 'Suivi documents', icon: FileText, link: '/coordinateur-documents' },
    { label: 'Cours & Devoirs', icon: BookOpen, link: '/cours-admin' },
    { label: 'Emploi du temps', icon: Clock, link: '/emploi-du-temps' },
    { label: 'Calendrier', icon: Calendar, link: '/calendrier' },
    { label: 'Bulletins', icon: Award, link: '/bulletins' },
    { label: 'Saisie des notes', icon: GraduationCap, link: '/notes' },
    { label: 'Performance', icon: TrendingUp, link: '/performance' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord Coordinateur</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Suivi des cycles Maternelle & Primaire — Vue d'ensemble
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer hover:shadow-md transition-shadow border"
            onClick={() => navigate(card.link)}
          >
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${card.bgColor} flex items-center justify-center mb-2`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs font-medium text-foreground/80 mt-0.5">{card.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Taux de complétion documents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Taux de complétion des dossiers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Documents déposés</span>
                <span className="font-semibold text-foreground">{tauxCompletion}%</span>
              </div>
              <Progress value={tauxCompletion} className="h-3" />
              <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  {stats.documentsComplets} déposés
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {stats.documentsManquants} manquants
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accès rapides */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Accès rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
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

      {/* Derniers documents */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dernières activités documents</CardTitle>
            <Button variant="link" size="sm" onClick={() => navigate('/coordinateur-documents')}>
              Voir tout
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun document récent</p>
          ) : (
            <div className="space-y-2">
              {recentDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-foreground">
                        {doc.coordinateur_eleves?.prenom} {doc.coordinateur_eleves?.nom}
                      </span>
                      <span className="text-muted-foreground ml-2">— {doc.type_document}</span>
                    </div>
                  </div>
                  <Badge variant={doc.statut === 'depose' ? 'default' : 'destructive'} className="text-[10px]">
                    {doc.statut === 'depose' ? 'Déposé' : 'Manquant'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
