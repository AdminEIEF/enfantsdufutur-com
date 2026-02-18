import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { BookOpen, FileText, Video, ExternalLink, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentCours() {
  const { session } = useStudentAuth();
  const [cours, setCours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!session) return;
    fetchCours();
  }, [session]);

  const fetchCours = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ matricule: session!.matricule, password: session!.password, action: 'cours' }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setCours(data.cours || []);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const filtered = cours.filter(c =>
    c.titre.toLowerCase().includes(search.toLowerCase()) ||
    c.matieres?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: Record<string, any[]>, c) => {
    const mat = c.matieres?.nom || 'Autre';
    if (!acc[mat]) acc[mat] = [];
    acc[mat].push(c);
    return acc;
  }, {});

  const getIcon = (type: string) => {
    if (type === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('video')) return <Video className="h-5 w-5 text-blue-500" />;
    return <ExternalLink className="h-5 w-5 text-green-500" />;
  };

  return (
    <StudentLayout>
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" /> Mes cours
        </h2>
        <p className="text-sm text-muted-foreground">Cours et documents de ta classe</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un cours ou une matière..."
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'Aucun résultat' : 'Aucun cours disponible pour le moment'}</p>
        </div>
      ) : (
        Object.entries(grouped).map(([matiere, items]: [string, any[]]) => (
          <div key={matiere} className="space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{matiere}</h3>
            {items.map((c: any) => (
              <Card key={c.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getIcon(c.type_contenu)}
                    <div>
                      <p className="font-medium text-sm">{c.titre}</p>
                      {c.description && <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(c.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={c.contenu_url} target="_blank" rel="noopener noreferrer">
                      Ouvrir
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
