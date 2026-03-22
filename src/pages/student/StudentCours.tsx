import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { BookOpen, FileText, Video, ExternalLink, Search, Loader2, Play, ChevronRight, ArrowLeft, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

function VideoEmbed({ url }: { url: string }) {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <video controls preload="metadata" className="w-full h-full" playsInline>
          <source src={url} />
        </video>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm flex items-center gap-1">
      <Play className="h-4 w-4" /> Ouvrir la vidéo
    </a>
  );
}

const MATIERE_COLORS = [
  'bg-blue-500/10 text-blue-600',
  'bg-green-500/10 text-green-600',
  'bg-purple-500/10 text-purple-600',
  'bg-orange-500/10 text-orange-600',
  'bg-red-500/10 text-red-600',
  'bg-teal-500/10 text-teal-600',
  'bg-pink-500/10 text-pink-600',
  'bg-indigo-500/10 text-indigo-600',
  'bg-amber-500/10 text-amber-600',
  'bg-cyan-500/10 text-cyan-600',
];

function isPdf(c: any) {
  const type = (c.type_contenu || '').toLowerCase();
  const url = (c.contenu_url || '').toLowerCase();
  return type === 'pdf' || url.endsWith('.pdf') || url.includes('.pdf?');
}

function PdfViewer({ url }: { url: string }) {
  // Use Google Docs viewer for cross-browser PDF rendering
  const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  return (
    <div className="w-full rounded-lg overflow-hidden border bg-muted/30" style={{ height: '70vh', minHeight: 400 }}>
      <iframe
        src={googleUrl}
        className="w-full h-full"
        title="Visualiseur PDF"
        loading="lazy"
      />
    </div>
  );
}

function getIcon(type: string) {
  if (type === 'pdf') return <FileText className="h-5 w-5 text-red-500" />;
  if (type === 'word') return <FileText className="h-5 w-5 text-blue-700" />;
  if (type?.includes('video')) return <Video className="h-5 w-5 text-blue-500" />;
  return <ExternalLink className="h-5 w-5 text-green-500" />;
}

function isVideo(c: any) {
  const type = (c.type_contenu || '').toLowerCase();
  const url = (c.contenu_url || '').toLowerCase();
  return type.includes('video') || url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || url.match(/\.(mp4|webm|ogg)(\?|$)/);
}

export default function StudentCours() {
  const { session } = useStudentAuth();
  const [cours, setCours] = useState<any[]>([]);
  const [classeMatieres, setClasseMatieres] = useState<any[]>([]);
  const [isSecondaire, setIsSecondaire] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState<any>(null);

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
          body: JSON.stringify({ token: session!.token, action: 'cours' }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setCours(data.cours || []);
      setClasseMatieres(data.classe_matieres || []);
      setIsSecondaire(data.is_secondaire || false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  // Build matières list with course counts
  const matieresWithCours = (() => {
    const map = new Map<string, { id: string; nom: string; pole: string | null; coursCount: number; cours: any[] }>();

    // Add all class matières first
    classeMatieres.forEach((cm: any) => {
      const mat = cm.matieres;
      if (mat && !map.has(mat.id)) {
        map.set(mat.id, { id: mat.id, nom: mat.nom, pole: mat.pole, coursCount: 0, cours: [] });
      }
    });

    // Add courses to their matière
    cours.forEach((c: any) => {
      const matId = c.matieres?.id || c.matiere_id;
      const matNom = c.matieres?.nom || 'Autre';
      if (!map.has(matId)) {
        map.set(matId, { id: matId, nom: matNom, pole: c.matieres?.pole, coursCount: 0, cours: [] });
      }
      const entry = map.get(matId)!;
      entry.coursCount++;
      entry.cours.push(c);
    });

    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  })();

  const filteredMatieres = matieresWithCours.filter(m =>
    m.nom.toLowerCase().includes(search.toLowerCase())
  );

  // Cours for selected matière
  const selectedCours = selectedMatiere
    ? matieresWithCours.find(m => m.id === selectedMatiere.id)?.cours || []
    : [];

  // For non-secondary: keep old behavior (flat list)
  const nonSecondaireCours = cours.filter(c =>
    c.titre?.toLowerCase().includes(search.toLowerCase()) ||
    c.matieres?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  const groupByMatiere = (items: any[]) => items.reduce((acc: Record<string, any[]>, c) => {
    const mat = c.matieres?.nom || 'Autre';
    if (!acc[mat]) acc[mat] = [];
    acc[mat].push(c);
    return acc;
  }, {});

  return (
    <StudentLayout>
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" /> Mes cours
        </h2>
        <p className="text-sm text-muted-foreground">
          {isSecondaire ? 'Sélectionne une matière pour accéder à tes cours' : 'Cours et documents de ta classe'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : isSecondaire ? (
        /* ── Secondary: Matières grid ── */
        selectedMatiere ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setSelectedMatiere(null)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Retour aux matières
            </Button>
            <h3 className="text-lg font-bold">{selectedMatiere.nom}</h3>

            {selectedCours.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Aucun cours disponible pour cette matière</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {selectedCours.map((c: any) => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getIcon(c.type_contenu)}
                          <div>
                            <p className="font-medium text-sm">{c.titre}</p>
                            {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(c.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <a href={c.contenu_url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
                        </Button>
                      </div>
                      {isVideo(c) && <VideoEmbed url={c.contenu_url} />}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher une matière..."
                className="pl-10"
              />
            </div>

            {filteredMatieres.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Aucune matière trouvée</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredMatieres.map((m, idx) => (
                  <Card
                    key={m.id}
                    className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
                    onClick={() => setSelectedMatiere(m)}
                  >
                    <CardContent className="py-4 px-4 flex flex-col items-center text-center gap-2">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${MATIERE_COLORS[idx % MATIERE_COLORS.length]}`}>
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-sm leading-tight">{m.nom}</p>
                      <Badge variant={m.coursCount > 0 ? 'default' : 'secondary'} className="text-[10px]">
                        {m.coursCount} cours
                      </Badge>
                      {m.coursCount > 0 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      ) : (
        /* ── Non-secondary: flat list (existing behavior) ── */
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un cours ou une matière..."
              className="pl-10"
            />
          </div>

          {nonSecondaireCours.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>{search ? 'Aucun résultat' : 'Aucun cours disponible'}</p>
            </div>
          ) : (
            Object.entries(groupByMatiere(nonSecondaireCours)).map(([matiere, items]: [string, any[]]) => (
              <div key={matiere} className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{matiere}</h3>
                {items.map((c: any) => (
                  <Card key={c.id}>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center justify-between">
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
                          <a href={c.contenu_url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
                        </Button>
                      </div>
                      {isVideo(c) && <VideoEmbed url={c.contenu_url} />}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))
          )}
        </div>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
