import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { BookOpen, FileText, Video, ExternalLink, Search, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';

function VideoEmbed({ url }: { url: string }) {
  // YouTube
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

  // Vimeo
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

  // MP4 / direct video
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return (
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
        <video controls preload="metadata" className="w-full h-full" playsInline>
          <source src={url} />
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      </div>
    );
  }

  // Fallback: link
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm flex items-center gap-1">
      <Play className="h-4 w-4" /> Ouvrir la vidéo
    </a>
  );
}

export default function StudentCours() {
  const { session } = useStudentAuth();
  const [cours, setCours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('documents');

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

  const isVideo = (c: any) => {
    const type = (c.type_contenu || '').toLowerCase();
    const url = (c.contenu_url || '').toLowerCase();
    return type.includes('video') || url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || url.match(/\.(mp4|webm|ogg)(\?|$)/);
  };

  const documents = cours.filter(c =>
    !isVideo(c) && (
      c.titre.toLowerCase().includes(search.toLowerCase()) ||
      c.matieres?.nom?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const videos = cours.filter(c =>
    isVideo(c) && (
      c.titre.toLowerCase().includes(search.toLowerCase()) ||
      c.matieres?.nom?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const groupByMatiere = (items: any[]) => items.reduce((acc: Record<string, any[]>, c) => {
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

  const renderDocuments = () => {
    if (documents.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>{search ? 'Aucun résultat' : 'Aucun document disponible'}</p>
        </div>
      );
    }
    const grouped = groupByMatiere(documents);
    return Object.entries(grouped).map(([matiere, items]: [string, any[]]) => (
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
                <a href={c.contenu_url} target="_blank" rel="noopener noreferrer">Ouvrir</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    ));
  };

  const renderVideos = () => {
    if (videos.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Video className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>{search ? 'Aucun résultat' : 'Aucune vidéo disponible'}</p>
        </div>
      );
    }
    const grouped = groupByMatiere(videos);
    return Object.entries(grouped).map(([matiere, items]: [string, any[]]) => (
      <div key={matiere} className="space-y-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{matiere}</h3>
        {items.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-500" />
                <p className="font-medium text-sm">{c.titre}</p>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(c.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              <VideoEmbed url={c.contenu_url} />
            </CardContent>
          </Card>
        ))}
      </div>
    ));
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
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="documents" className="gap-1">
              <FileText className="h-4 w-4" /> Documents ({documents.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1">
              <Video className="h-4 w-4" /> Vidéothèque ({videos.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="space-y-4 mt-3">
            {renderDocuments()}
          </TabsContent>
          <TabsContent value="videos" className="space-y-4 mt-3">
            {renderVideos()}
          </TabsContent>
        </Tabs>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
