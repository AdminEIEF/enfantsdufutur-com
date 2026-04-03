import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Eye, Loader2, FileQuestion, CheckCircle2, Clock, GripVertical, Upload, FileText, Wifi, Users, ChevronDown, ChevronUp, Monitor } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ConnectedStudent {
  id: string;
  display_name: string;
  classe_nom: string | null;
  niveau_nom: string | null;
  connected_at: string;
  last_seen_at: string;
}

function ConnectedStudentsDashboard() {
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['connected-students-compositions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('active_connections')
        .select('id, type, display_name, classe_nom, niveau_nom, connected_at, last_seen_at')
        .eq('type', 'eleve')
        .order('classe_nom');
      return (data || []) as ConnectedStudent[];
    },
    refetchInterval: 2000,
  });

  // Fetch total students per class
  const { data: classeEffectifs = [] } = useQuery({
    queryKey: ['classe-effectifs-compositions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('eleves')
        .select('classe_id, classes:classe_id(nom)')
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .not('classe_id', 'is', null);
      const map = new Map<string, number>();
      (data || []).forEach((e: any) => {
        const nom = e.classes?.nom || 'Sans classe';
        map.set(nom, (map.get(nom) || 0) + 1);
      });
      return Array.from(map.entries()).map(([nom, total]) => ({ nom, total }));
    },
    staleTime: 30000,
  });

  const uniqueConnections = useMemo(() => {
    const map = new Map<string, ConnectedStudent>();
    connections.forEach(c => {
      const key = c.display_name;
      const existing = map.get(key);
      if (!existing || new Date(c.last_seen_at) > new Date(existing.last_seen_at)) {
        map.set(key, c);
      }
    });
    return Array.from(map.values());
  }, [connections]);

  const OFFLINE_THRESHOLD_MS = 30000;

  const grouped = useMemo(() => {
    const map = new Map<string, (ConnectedStudent & { isOnline: boolean })[]>();
    uniqueConnections.forEach(c => {
      const key = c.classe_nom || 'Sans classe';
      if (!map.has(key)) map.set(key, []);
      const isOnline = (now - new Date(c.last_seen_at).getTime()) < OFFLINE_THRESHOLD_MS;
      map.get(key)!.push({ ...c, isOnline });
    });
    map.forEach((students, key) => {
      map.set(key, students.sort((a, b) => (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1)));
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [uniqueConnections, now]);

  // Build full class stats including classes with 0 connections
  const classStats = useMemo(() => {
    const connectedMap = new Map<string, { online: number; offline: number; students: (ConnectedStudent & { isOnline: boolean })[] }>();
    grouped.forEach(([className, students]) => {
      const online = students.filter(s => s.isOnline).length;
      const offline = students.filter(s => !s.isOnline).length;
      connectedMap.set(className, { online, offline, students });
    });

    const allClasses = new Set([
      ...classeEffectifs.map(c => c.nom),
      ...connectedMap.keys(),
    ]);

    return Array.from(allClasses).sort().map(className => {
      const effectif = classeEffectifs.find(c => c.nom === className)?.total || 0;
      const conn = connectedMap.get(className) || { online: 0, offline: 0, students: [] };
      const neverConnected = Math.max(0, effectif - conn.online - conn.offline);
      return { className, effectif, ...conn, neverConnected };
    });
  }, [grouped, classeEffectifs]);

  const totalOnline = classStats.reduce((s, c) => s + c.online, 0);
  const totalOffline = classStats.reduce((s, c) => s + c.offline, 0);
  const totalNever = classStats.reduce((s, c) => s + c.neverConnected, 0);

  if (isLoading) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent">
        <CardContent className="py-4 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Chargement des connexions...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="relative">
              <Monitor className="h-5 w-5 text-emerald-600" />
              {totalOnline > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
            Élèves connectés en temps réel
          </CardTitle>
          <Badge className={`${totalOnline > 0 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'} text-sm px-3`}>
            <Wifi className="h-3.5 w-3.5 mr-1.5" />
            {totalOnline} en ligne
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {totalOnline === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun élève connecté actuellement</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {grouped.map(([className, students]) => (
              <Collapsible
                key={className}
                open={expandedClass === className}
                onOpenChange={(open) => setExpandedClass(open ? className : null)}
              >
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left border rounded-xl p-3 bg-card hover:bg-accent/50 transition-colors group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <Users className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{className}</p>
                          <p className="text-xs text-muted-foreground">
                            {students.filter(s => s.isOnline).length} en ligne / {students.length} total
                          </p>
                        </div>
                      </div>
                      {expandedClass === className ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1 border rounded-lg bg-muted/30 divide-y max-h-48 overflow-y-auto">
                    {students.map(s => {
                      const lastSeenMs = now - new Date(s.last_seen_at).getTime();
                      const agoMin = Math.round(lastSeenMs / 60000);
                      return (
                        <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${s.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span className={`text-sm truncate ${!s.isOnline ? 'text-muted-foreground' : ''}`}>{s.display_name}</span>
                          </div>
                          {s.isOnline ? (
                            <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600 px-1.5 py-0">
                              En ligne
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              Hors ligne • {agoMin < 1 ? '<1m' : `${agoMin}m`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Composition {
  id: string;
  titre: string;
  description: string | null;
  classe_id: string;
  matiere_id: string;
  duree_minutes: number;
  date_debut: string;
  date_fin: string;
  bareme: number;
  publie: boolean;
  created_at: string;
  type_composition: string;
  sujet_url: string | null;
  sujet_nom: string | null;
  classes?: { nom: string };
  matieres?: { nom: string };
}

interface Question {
  id?: string;
  composition_id?: string;
  type_question: 'qcm' | 'vrai_faux' | 'texte';
  enonce: string;
  options: { label: string; correct?: boolean }[];
  reponse_correcte: string;
  points: number;
  ordre: number;
}

export default function CompositionsAdmin() {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [matieres, setMatieres] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showQuestions, setShowQuestions] = useState<string | null>(null);
  const [editComp, setEditComp] = useState<Composition | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showResults, setShowResults] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Form state
  const [form, setForm] = useState({
    titre: '', description: '', classe_id: '', matiere_id: '',
    duree_minutes: 30, date_debut: '', date_fin: '', bareme: 20,
    type_composition: 'qcm' as string,
    sujet_url: '' as string,
    sujet_nom: '' as string,
  });
  const [filterClasse, setFilterClasse] = useState('all');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [compRes, classesRes, matieresRes] = await Promise.all([
      supabase.from('compositions').select('*, classes:classe_id(nom), matieres:matiere_id(nom)').order('created_at', { ascending: false }),
      supabase.from('classes').select('id, nom, niveau_id, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))').order('nom'),
      supabase.from('matieres').select('id, nom').order('nom'),
    ]);
    setCompositions((compRes.data || []) as any);
    setClasses(classesRes.data || []);
    setMatieres(matieresRes.data || []);
    setLoading(false);
  }

  // Get matieres for selected classe via classe_matieres
  const [classeMatieres, setClasseMatieres] = useState<any[]>([]);
  useEffect(() => {
    if (!form.classe_id) { setClasseMatieres([]); return; }
    supabase.from('classe_matieres').select('matiere_id, matieres:matiere_id(id, nom)')
      .eq('classe_id', form.classe_id)
      .then(({ data }) => setClasseMatieres(data || []));
  }, [form.classe_id]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Seuls les fichiers PDF et Word sont acceptés');
      return;
    }
    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `compositions/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('cours').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('cours').getPublicUrl(fileName);
      setForm(prev => ({ ...prev, sujet_url: urlData.publicUrl, sujet_nom: file.name }));
      toast.success('Fichier uploadé');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSave() {
    if (!form.titre || !form.classe_id || !form.matiere_id || !form.date_debut || !form.date_fin) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    if (form.type_composition === 'document' && !form.sujet_url && !editComp?.sujet_url) {
      toast.error('Veuillez uploader un fichier sujet (PDF ou Word)'); return;
    }
    // texte type needs questions but validated at publish time
    const payload: any = {
      titre: form.titre, description: form.description || null,
      classe_id: form.classe_id, matiere_id: form.matiere_id,
      duree_minutes: form.duree_minutes, date_debut: form.date_debut,
      date_fin: form.date_fin, bareme: form.bareme,
      type_composition: form.type_composition,
      sujet_url: form.sujet_url || null,
      sujet_nom: form.sujet_nom || null,
    };
    if (editComp) {
      const { error } = await supabase.from('compositions').update(payload).eq('id', editComp.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Composition modifiée');
    } else {
      const { error } = await supabase.from('compositions').insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success('Composition créée');
    }
    setShowForm(false); setEditComp(null);
    resetForm();
    fetchAll();
  }

  function resetForm() {
    setForm({ titre: '', description: '', classe_id: '', matiere_id: '', duree_minutes: 30, date_debut: '', date_fin: '', bareme: 20, type_composition: 'qcm', sujet_url: '', sujet_nom: '' });
  }

  async function togglePublie(comp: Composition) {
    if (!comp.publie) {
      if (comp.type_composition === 'qcm' || comp.type_composition === 'texte') {
        const { count } = await supabase.from('composition_questions').select('id', { count: 'exact', head: true }).eq('composition_id', comp.id);
        if (!count || count === 0) {
          toast.error('Ajoutez des questions avant de publier'); return;
        }
      } else if (!comp.sujet_url) {
        toast.error('Ajoutez un fichier sujet avant de publier'); return;
      }
    }
    const { error } = await supabase.from('compositions').update({ publie: !comp.publie }).eq('id', comp.id);
    if (error) { toast.error(error.message); return; }
    toast.success(comp.publie ? 'Composition masquée' : 'Composition publiée pour les élèves');
    fetchAll();
  }

  async function deleteComp(id: string) {
    if (!confirm('Supprimer cette composition et toutes ses questions ?')) return;
    const { error } = await supabase.from('compositions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Supprimée'); fetchAll();
  }

  // Questions management
  async function openQuestions(compId: string) {
    setShowQuestions(compId);
    setQuestionsLoading(true);
    const { data } = await supabase.from('composition_questions').select('*').eq('composition_id', compId).order('ordre');
    setQuestions((data || []).map((q: any) => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    })));
    setQuestionsLoading(false);
  }

  function addQuestion(type: 'qcm' | 'vrai_faux' | 'texte') {
    const newQ: Question = {
      type_question: type,
      enonce: '',
      options: type === 'vrai_faux'
        ? [{ label: 'Vrai' }, { label: 'Faux' }]
        : type === 'texte'
        ? []
        : [{ label: '' }, { label: '' }, { label: '' }, { label: '' }],
      reponse_correcte: type === 'texte' ? '_texte_' : '',
      points: 1,
      ordre: questions.length,
    };
    setQuestions([...questions, newQ]);
  }

  function updateQuestion(idx: number, partial: Partial<Question>) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...partial } : q));
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveQuestions() {
    if (!showQuestions) return;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.enonce.trim()) { toast.error(`Question ${i + 1}: énoncé requis`); return; }
      if (q.type_question !== 'texte' && !q.reponse_correcte) { toast.error(`Question ${i + 1}: réponse correcte requise`); return; }
      if (q.type_question === 'qcm' && q.options.some(o => !o.label.trim())) {
        toast.error(`Question ${i + 1}: toutes les options doivent être remplies`); return;
      }
    }
    await supabase.from('composition_questions').delete().eq('composition_id', showQuestions);
    const rows = questions.map((q, i) => ({
      composition_id: showQuestions,
      type_question: q.type_question,
      enonce: q.enonce,
      options: q.options,
      reponse_correcte: q.reponse_correcte,
      points: q.points,
      ordre: i,
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from('composition_questions').insert(rows);
      if (error) { toast.error(error.message); return; }
    }
    toast.success('Questions sauvegardées');
    setShowQuestions(null);
  }

  // Results
  async function openResults(compId: string) {
    setShowResults(compId);
    const comp = compositions.find(c => c.id === compId);
    const { data } = await supabase.from('composition_reponses')
      .select('*, eleves:eleve_id(nom, prenom, matricule)')
      .eq('composition_id', compId)
      .order('score', { ascending: false });
    setResults((data || []).map((r: any) => ({ ...r, _type: comp?.type_composition })));
  }

  const filtered = filterClasse === 'all' ? compositions : compositions.filter(c => c.classe_id === filterClasse);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const currentResultComp = compositions.find(c => c.id === showResults);

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Connected Students Dashboard */}
      <ConnectedStudentsDashboard />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compositions en ligne</h1>
          <p className="text-sm text-muted-foreground">Gérer les examens QCM, Vrai/Faux, Texte et Documents</p>
        </div>
        <Button onClick={() => { setEditComp(null); resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle composition
        </Button>
      </div>

      <div className="flex gap-2 items-center">
        <Label className="text-sm">Classe :</Label>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune composition créée</CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map(comp => (
            <Card key={comp.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{comp.titre}</h3>
                          <Badge variant="outline" className="text-xs">
                            {comp.type_composition === 'document' ? '📄 Document' : comp.type_composition === 'texte' ? '✍️ Texte' : '📝 QCM'}
                          </Badge>
                      {comp.publie ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Publiée</Badge>
                      ) : (
                        <Badge variant="secondary">Brouillon</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(comp as any).classes?.nom} • {(comp as any).matieres?.nom} • {comp.duree_minutes} min • /{comp.bareme}
                    </p>
                    {comp.sujet_nom && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <FileText className="h-3 w-3 inline mr-1" />
                        Sujet : {comp.sujet_nom}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(comp.date_debut).toLocaleDateString('fr')} → {new Date(comp.date_fin).toLocaleDateString('fr')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(comp.type_composition === 'qcm' || comp.type_composition === 'texte') && (
                      <Button variant="outline" size="sm" onClick={() => openQuestions(comp.id)}>
                        <FileQuestion className="h-4 w-4 mr-1" /> Questions
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openResults(comp.id)}>
                      <Eye className="h-4 w-4 mr-1" /> Résultats
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditComp(comp);
                      setForm({
                        titre: comp.titre, description: comp.description || '',
                        classe_id: comp.classe_id, matiere_id: comp.matiere_id,
                        duree_minutes: comp.duree_minutes,
                        date_debut: comp.date_debut.slice(0, 16),
                        date_fin: comp.date_fin.slice(0, 16),
                        bareme: comp.bareme,
                        type_composition: comp.type_composition || 'qcm',
                        sujet_url: comp.sujet_url || '',
                        sujet_nom: comp.sujet_nom || '',
                      });
                      setShowForm(true);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <Switch checked={comp.publie} onCheckedChange={() => togglePublie(comp)} />
                      <span className="text-xs">{comp.publie ? 'En ligne' : 'Hors ligne'}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteComp(comp.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editComp ? 'Modifier la composition' : 'Nouvelle composition'}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {!editComp && (
              <div>
                <Label>Type de composition *</Label>
                <Select value={form.type_composition} onValueChange={v => setForm({ ...form, type_composition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qcm">📝 QCM / Vrai-Faux</SelectItem>
                    <SelectItem value="texte">✍️ Questions texte — Réponse libre</SelectItem>
                    <SelectItem value="document">📄 Document (PDF/Word) — Réponse texte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Titre *</Label><Input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Classe *</Label>
                <Select value={form.classe_id} onValueChange={v => setForm({ ...form, classe_id: v, matiere_id: '' })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Matière *</Label>
                <Select value={form.matiere_id} onValueChange={v => setForm({ ...form, matiere_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {classeMatieres.map((cm: any) => (
                      <SelectItem key={cm.matiere_id} value={cm.matiere_id}>{cm.matieres?.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Durée (min)</Label><Input type="number" value={form.duree_minutes} onChange={e => setForm({ ...form, duree_minutes: Number(e.target.value) })} /></div>
              <div><Label>Barème</Label><Input type="number" value={form.bareme} onChange={e => setForm({ ...form, bareme: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Début *</Label><Input type="datetime-local" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} /></div>
              <div><Label>Fin *</Label><Input type="datetime-local" value={form.date_fin} onChange={e => setForm({ ...form, date_fin: e.target.value })} /></div>
            </div>
            {form.type_composition === 'document' && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                <Label>📄 Fichier sujet (PDF ou Word) *</Label>
                {form.sujet_nom ? (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm truncate flex-1">{form.sujet_nom}</span>
                    <Button variant="outline" size="sm" onClick={() => setForm(prev => ({ ...prev, sujet_url: '', sujet_nom: '' }))}>
                      Changer
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                    {uploadingFile && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Upload en cours...</p>}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Les élèves verront ce document et répondront en texte avec possibilité d'insérer des images et formules mathématiques.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={handleSave}>{editComp ? 'Modifier' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog - for QCM and Texte types */}
      <Dialog open={!!showQuestions} onOpenChange={() => setShowQuestions(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Questions de la composition</DialogTitle>
            <p className="text-sm text-muted-foreground">Total : {questions.length} questions • {totalPoints} points</p>
          </DialogHeader>
          {questionsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <Card key={idx} className="border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">
                        {q.type_question === 'qcm' ? 'QCM' : q.type_question === 'texte' ? '✍️ Texte' : 'Vrai/Faux'} — Q{idx + 1}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Points:</Label>
                        <Input type="number" className="w-16 h-8" value={q.points} onChange={e => updateQuestion(idx, { points: Number(e.target.value) })} min={0.5} step={0.5} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeQuestion(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea placeholder="Énoncé de la question" value={q.enonce} onChange={e => updateQuestion(idx, { enonce: e.target.value })} rows={2} />
                    {q.type_question === 'texte' ? (
                      <p className="text-xs text-muted-foreground italic">L'élève répondra en texte libre à cette question. La correction sera manuelle.</p>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Réponse correcte :</Label>
                        <RadioGroup value={q.reponse_correcte} onValueChange={v => updateQuestion(idx, { reponse_correcte: v })}>
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <RadioGroupItem value={opt.label || `opt_${oi}`} id={`q${idx}_o${oi}`} />
                              {q.type_question === 'vrai_faux' ? (
                                <Label htmlFor={`q${idx}_o${oi}`} className="cursor-pointer">{opt.label}</Label>
                              ) : (
                                <Input
                                  className="flex-1 h-8"
                                  placeholder={`Option ${oi + 1}`}
                                  value={opt.label}
                                  onChange={e => {
                                    const newOpts = [...q.options];
                                    const oldLabel = newOpts[oi].label;
                                    newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                                    const updatedCorrect = q.reponse_correcte === oldLabel ? e.target.value : q.reponse_correcte;
                                    updateQuestion(idx, { options: newOpts, reponse_correcte: updatedCorrect });
                                  }}
                                />
                              )}
                              {q.reponse_correcte === (opt.label || `opt_${oi}`) && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {(() => {
                const compForQuestions = compositions.find(c => c.id === showQuestions);
                const isTexteType = compForQuestions?.type_composition === 'texte';
                return (
                  <div className="flex gap-2">
                    {!isTexteType && (
                      <>
                        <Button variant="outline" onClick={() => addQuestion('qcm')}>
                          <Plus className="h-4 w-4 mr-1" /> QCM
                        </Button>
                        <Button variant="outline" onClick={() => addQuestion('vrai_faux')}>
                          <Plus className="h-4 w-4 mr-1" /> Vrai/Faux
                        </Button>
                      </>
                    )}
                    {isTexteType && (
                      <Button variant="outline" onClick={() => addQuestion('texte')}>
                        <Plus className="h-4 w-4 mr-1" /> Question texte
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestions(null)}>Annuler</Button>
            <Button onClick={saveQuestions}>Sauvegarder les questions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={!!showResults} onOpenChange={() => setShowResults(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Résultats</DialogTitle></DialogHeader>
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun élève n'a encore passé cette composition</p>
          ) : (
            <div className="space-y-2">
              {results.map((r: any) => (
                <Card key={r.id} className="border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{r.eleves?.prenom} {r.eleves?.nom}</p>
                        <p className="text-xs text-muted-foreground">{r.eleves?.matricule}</p>
                      </div>
                      <div className="text-right">
                        {(currentResultComp?.type_composition === 'document' || currentResultComp?.type_composition === 'texte') ? (
                          <>
                            <Badge variant={r.score != null ? 'default' : 'secondary'}>
                              {r.score != null ? `${r.score}/${currentResultComp.bareme}` : 'À noter'}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {r.soumis_at ? new Date(r.soumis_at).toLocaleString('fr') : 'En cours...'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-bold text-lg">{r.score ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.soumis_at ? new Date(r.soumis_at).toLocaleString('fr') : 'En cours...'}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {(currentResultComp?.type_composition === 'document' || currentResultComp?.type_composition === 'texte') && r.reponse_texte && (
                      <details className="mt-2">
                        <summary className="text-xs text-primary cursor-pointer">Voir la réponse de l'élève</summary>
                        <div className="mt-2 p-3 bg-muted/50 rounded text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: r.reponse_texte }} />
                        {r.score == null && (
                          <div className="mt-2 flex items-center gap-2">
                            <Input type="number" placeholder="Note" className="w-20" min={0} max={currentResultComp.bareme}
                              id={`note-${r.id}`} />
                            <Button size="sm" onClick={async () => {
                              const noteEl = document.getElementById(`note-${r.id}`) as HTMLInputElement;
                              const note = Number(noteEl?.value);
                              if (isNaN(note)) { toast.error('Saisissez une note valide'); return; }
                              const { error } = await supabase.from('composition_reponses')
                                .update({ score: note } as any).eq('id', r.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success('Note enregistrée');
                              openResults(showResults!);
                            }}>
                              Noter
                            </Button>
                          </div>
                        )}
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}