import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { BookOpen, FileText, Video, ExternalLink, Search, Loader2, Play, ArrowLeft, FolderOpen, Eye, Download, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

function VideoEmbed({ url }: { url: string }) {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return (
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
        <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}?rel=0`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    );
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return (
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
        <iframe src={`https://player.vimeo.com/video/${vimeoMatch[1]}`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
      </div>
    );
  }
  if (url.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return (
      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
        <video controls preload="metadata" className="w-full h-full" playsInline><source src={url} /></video>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm flex items-center gap-1">
      <Play className="h-4 w-4" /> Ouvrir la vidéo
    </a>
  );
}

const MATIERE_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
  'from-sky-500 to-indigo-600',
  'from-red-500 to-rose-600',
];

const MATIERE_EMOJIS: Record<string, string> = {
  math: '🔢', francais: '📖', français: '📖', lecture: '📖', science: '🔬', svt: '🔬',
  histoire: '📜', geo: '🌍', physique: '⚡', chimie: '🧪', anglais: '🇬🇧',
  arabe: '🕌', civique: '🏛️', sport: '⚽', musique: '🎵', dessin: '🎨',
  informatique: '💻', philosophie: '🤔', economie: '📊', techno: '🔧',
};

function getMatiereEmoji(nom: string): string {
  const lower = nom.toLowerCase();
  for (const [key, emoji] of Object.entries(MATIERE_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '📚';
}

function isPdf(c: any) {
  const type = (c.type_contenu || '').toLowerCase();
  const url = (c.contenu_url || '').toLowerCase();
  return type === 'pdf' || url.endsWith('.pdf') || url.includes('.pdf?');
}

function PdfViewer({ url }: { url: string }) {
  const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  return (
    <div className="w-full rounded-2xl overflow-hidden border bg-muted/30 shadow-inner" style={{ height: '70vh', minHeight: 400 }}>
      <iframe src={googleUrl} className="w-full h-full" title="Visualiseur PDF" loading="lazy" />
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
  const [viewingCours, setViewingCours] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchCours();
  }, [session]);

  const fetchCours = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session!.token, action: 'cours' }),
      });
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

  const matieresWithCours = (() => {
    const map = new Map<string, { id: string; nom: string; pole: string | null; coursCount: number; cours: any[] }>();
    classeMatieres.forEach((cm: any) => {
      const mat = cm.matieres;
      if (mat && !map.has(mat.id)) map.set(mat.id, { id: mat.id, nom: mat.nom, pole: mat.pole, coursCount: 0, cours: [] });
    });
    cours.forEach((c: any) => {
      const matId = c.matieres?.id || c.matiere_id;
      const matNom = c.matieres?.nom || 'Autre';
      if (!map.has(matId)) map.set(matId, { id: matId, nom: matNom, pole: c.matieres?.pole, coursCount: 0, cours: [] });
      const entry = map.get(matId)!;
      entry.coursCount++;
      entry.cours.push(c);
    });
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  })();

  const filteredMatieres = matieresWithCours.filter(m => m.nom.toLowerCase().includes(search.toLowerCase()));

  const selectedCours = selectedMatiere
    ? matieresWithCours.find(m => m.id === selectedMatiere.id)?.cours || []
    : [];

  const nonSecondaireCours = cours.filter(c =>
    c.titre?.toLowerCase().includes(search.toLowerCase()) || c.matieres?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  const groupByMatiere = (items: any[]) => items.reduce((acc: Record<string, any[]>, c) => {
    const mat = c.matieres?.nom || 'Autre';
    if (!acc[mat]) acc[mat] = [];
    acc[mat].push(c);
    return acc;
  }, {});

  const renderCoursCard = (c: any) => (
    <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20 }}>
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-shadow active:scale-[0.98]">
        <CardContent className="p-0">
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                {getIcon(c.type_contenu)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight">{c.titre}</p>
                {c.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  📅 {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {(isPdf(c) || isVideo(c)) && (
                <Button
                  size="sm"
                  variant={viewingCours === c.id ? 'default' : 'outline'}
                  className="rounded-xl text-xs h-8 flex-1"
                  onClick={() => setViewingCours(viewingCours === c.id ? null : c.id)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  {viewingCours === c.id ? 'Fermer' : '👁️ Consulter'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-xl text-xs h-8 flex-1" asChild>
                <a href={c.contenu_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5 mr-1" /> Télécharger
                </a>
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {viewingCours === c.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-4">
                {isPdf(c) && <PdfViewer url={c.contenu_url} />}
                {isVideo(c) && <VideoEmbed url={c.contenu_url} />}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <StudentLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Mes cours</h2>
            <p className="text-xs text-muted-foreground">
              {isSecondaire ? 'Sélectionne une matière' : 'Cours et documents de ta classe'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : isSecondaire ? (
          <AnimatePresence mode="wait">
            {selectedMatiere ? (
              <motion.div key="detail" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedMatiere(null)} className="gap-1 rounded-xl">
                  <ArrowLeft className="h-4 w-4" /> Retour
                </Button>

                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getMatiereEmoji(selectedMatiere.nom)}</span>
                  <div>
                    <h3 className="text-base font-bold">{selectedMatiere.nom}</h3>
                    <p className="text-xs text-muted-foreground">{selectedCours.length} document(s)</p>
                  </div>
                </div>

                {selectedCours.length === 0 ? (
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Aucun cours disponible</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">{selectedCours.map(renderCoursCard)}</div>
                )}
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-10 rounded-2xl border-0 bg-muted/60 h-11 shadow-sm" />
                </div>

                {filteredMatieres.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Aucune matière trouvée</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {filteredMatieres.map((m, idx) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04, type: 'spring', damping: 20 }}
                      >
                        <Card
                          className="cursor-pointer border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-xl transition-all active:scale-[0.95]"
                          onClick={() => setSelectedMatiere(m)}
                        >
                          <div className={`h-20 bg-gradient-to-br ${MATIERE_GRADIENTS[idx % MATIERE_GRADIENTS.length]} flex items-center justify-center relative`}>
                            <span className="text-3xl drop-shadow-lg">{getMatiereEmoji(m.nom)}</span>
                            {m.coursCount > 0 && (
                              <div className="absolute top-2 right-2 bg-white/25 backdrop-blur-sm rounded-full px-2 py-0.5">
                                <span className="text-[10px] text-white font-bold">{m.coursCount}</span>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3 text-center">
                            <p className="text-xs font-bold leading-tight line-clamp-2">{m.nom}</p>
                            <div className="flex items-center justify-center gap-1 mt-1.5">
                              <span className="text-[10px] text-muted-foreground">{m.coursCount} cours</span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          /* Non-secondary flat list */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="pl-10 rounded-2xl border-0 bg-muted/60 h-11 shadow-sm" />
            </div>

            {nonSecondaireCours.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{search ? 'Aucun résultat' : 'Aucun cours disponible'}</p>
              </div>
            ) : (
              Object.entries(groupByMatiere(nonSecondaireCours)).map(([matiere, items]: [string, any[]]) => (
                <div key={matiere} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getMatiereEmoji(matiere)}</span>
                    <h3 className="font-bold text-sm">{matiere}</h3>
                    <Badge variant="secondary" className="text-[10px] rounded-full">{items.length}</Badge>
                  </div>
                  {items.map(renderCoursCard)}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {/* Extra spacer for bottom nav on desktop */}
      <div className="h-8 sm:h-4" />
      <StudentAIChat />
    </StudentLayout>
  );
}
