import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { Plus, Trash2, Edit, Eye, Loader2, FileQuestion, CheckCircle2, Clock, GripVertical, Upload, FileText, Wifi, Users, ChevronDown, ChevronUp, Monitor, BarChart3, Download, Printer, Trophy, Award } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MathText } from '@/components/MathText';

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
    const interval = setInterval(() => setNow(Date.now()), 1000);
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
    refetchInterval: 1000,
  });

  // Fetch total students per class with niveau info
  const { data: classeEffectifs = [] } = useQuery({
    queryKey: ['classe-effectifs-compositions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('eleves')
        .select('classe_id, classes:classe_id(nom, niveaux:niveau_id(nom, ordre, cycles:cycle_id(nom, ordre)))')
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .not('classe_id', 'is', null);
      const map = new Map<string, { total: number; niveau: string; niveauOrdre: number; cycle: string; cycleOrdre: number }>();
      (data || []).forEach((e: any) => {
        const nom = e.classes?.nom || 'Sans classe';
        const niveau = e.classes?.niveaux?.nom || '';
        const niveauOrdre = e.classes?.niveaux?.ordre || 0;
        const cycle = e.classes?.niveaux?.cycles?.nom || '';
        const cycleOrdre = e.classes?.niveaux?.cycles?.ordre || 0;
        const existing = map.get(nom);
        if (existing) {
          existing.total++;
        } else {
          map.set(nom, { total: 1, niveau, niveauOrdre, cycle, cycleOrdre });
        }
      });
      return Array.from(map.entries()).map(([nom, info]) => ({ nom, ...info }));
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

  // Build full class stats including classes with 0 connections, grouped by niveau
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

    const classItems = Array.from(allClasses).map(className => {
      const info = classeEffectifs.find(c => c.nom === className);
      const effectif = info?.total || 0;
      const niveau = info?.niveau || 'Autre';
      const niveauOrdre = info?.niveauOrdre || 999;
      const cycle = info?.cycle || '';
      const cycleOrdre = info?.cycleOrdre || 999;
      const conn = connectedMap.get(className) || { online: 0, offline: 0, students: [] };
      const neverConnected = Math.max(0, effectif - conn.online - conn.offline);
      return { className, effectif, niveau, niveauOrdre, cycle, cycleOrdre, ...conn, neverConnected };
    });

    // Group by niveau
    const niveauMap = new Map<string, { niveauOrdre: number; cycleOrdre: number; cycle: string; classes: typeof classItems }>();
    classItems.forEach(item => {
      const key = item.niveau;
      if (!niveauMap.has(key)) {
        niveauMap.set(key, { niveauOrdre: item.niveauOrdre, cycleOrdre: item.cycleOrdre, cycle: item.cycle, classes: [] });
      }
      niveauMap.get(key)!.classes.push(item);
    });

    // Sort niveaux by cycle order then niveau order
    return Array.from(niveauMap.entries())
      .sort((a, b) => (a[1].cycleOrdre - b[1].cycleOrdre) || (a[1].niveauOrdre - b[1].niveauOrdre))
      .map(([niveau, data]) => ({
        niveau,
        cycle: data.cycle,
        classes: data.classes.sort((a, b) => a.className.localeCompare(b.className)),
      }));
  }, [grouped, classeEffectifs]);

  const allClassItems = classStats.flatMap(n => n.classes);
  const totalOnline = allClassItems.reduce((s, c) => s + c.online, 0);
  const totalOffline = allClassItems.reduce((s, c) => s + c.offline, 0);
  const totalNever = allClassItems.reduce((s, c) => s + c.neverConnected, 0);

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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="relative">
              <Monitor className="h-5 w-5 text-emerald-600" />
              {totalOnline > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              )}
            </div>
            Élèves connectés en temps réel
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${totalOnline > 0 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'} text-sm px-3`}>
              <Wifi className="h-3.5 w-3.5 mr-1.5" />
              {totalOnline} en ligne
            </Badge>
            <Badge variant="outline" className="text-sm px-3 border-orange-300 text-orange-600">
              {totalOffline} hors ligne
            </Badge>
            <Badge variant="outline" className="text-sm px-3 border-gray-300 text-muted-foreground">
              {totalNever} jamais connecté{totalNever > 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {classStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée de connexion</p>
        ) : (
          <div className="space-y-5">
            {classStats.map(({ niveau, cycle, classes: niveauClasses }) => {
              const nOnline = niveauClasses.reduce((s, c) => s + c.online, 0);
              const nTotal = niveauClasses.reduce((s, c) => s + c.effectif, 0);
              return (
                <div key={niveau}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-bold text-foreground">{niveau}</h3>
                    <Badge variant="secondary" className="text-[10px]">{cycle}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{nOnline}/{nTotal} en ligne</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {niveauClasses.map(({ className, effectif, online, offline, neverConnected, students }) => (
                      <Collapsible
                        key={className}
                        open={expandedClass === className}
                        onOpenChange={(open) => setExpandedClass(open ? className : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <button className="w-full text-left border rounded-xl p-3 bg-card hover:bg-accent/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                  <Users className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate">{className}</p>
                                  <p className="text-[10px] text-muted-foreground leading-tight">
                                    <span className="text-emerald-600">{online}🟢</span>
                                    {' '}<span className="text-orange-500">{offline}🟠</span>
                                    {' '}<span>{neverConnected}⚪</span>
                                    {' '}/ {effectif}
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
                            {neverConnected > 0 && (
                              <div className="px-3 py-2 text-xs text-muted-foreground italic">
                                + {neverConnected} élève{neverConnected > 1 ? 's' : ''} jamais connecté{neverConnected > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              );
            })}
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
  type_question: 'qcm' | 'qcm_multiple' | 'vrai_faux' | 'texte';
  enonce: string;
  options: { label: string; correct?: boolean }[];
  reponse_correcte: string;
  points: number;
  ordre: number;
}

export default function CompositionsAdmin() {
  const { roles } = useAuth();
  const isCoordPrimaire = roles.includes('coordinateur');
  const isCoordSecondaire = roles.includes('coordinateur_secondaire');
  const isCoordinateur = isCoordPrimaire || isCoordSecondaire;
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
  const [resultsByClassComp, setResultsByClassComp] = useState<string | null>(null);
  const [resultsByClassData, setResultsByClassData] = useState<any[]>([]);
  const [resultsByClassLoading, setResultsByClassLoading] = useState(false);
  const [resultsByClassEffectif, setResultsByClassEffectif] = useState<any[]>([]);

  // Form state
  const [form, setForm] = useState({
    titre: '', description: '', classe_id: '', classe_ids: [] as string[], matiere_id: '',
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
    let allClasses = classesRes.data || [];
    let allComps = (compRes.data || []) as any[];

    // Coordinateur primaire: filter to Crèche/Maternelle/Primaire only
    if (isCoordPrimaire) {
      const primaryCycles = ['Crèche', 'Maternelle', 'Primaire'];
      allClasses = allClasses.filter((c: any) => primaryCycles.includes(c.niveaux?.cycles?.nom));
      const primaryClassIds = new Set(allClasses.map((c: any) => c.id));
      allComps = allComps.filter((c: any) => primaryClassIds.has(c.classe_id));
    }

    // Coordinateur secondaire: filter to Collège/Lycée only
    if (isCoordSecondaire) {
      const secondaryCycles = ['Collège', 'Lycée'];
      allClasses = allClasses.filter((c: any) => secondaryCycles.includes(c.niveaux?.cycles?.nom));
      const secondaryClassIds = new Set(allClasses.map((c: any) => c.id));
      allComps = allComps.filter((c: any) => secondaryClassIds.has(c.classe_id));
    }

    setCompositions(allComps);
    setClasses(allClasses);
    setMatieres(matieresRes.data || []);
    setLoading(false);
  }

  // Get common matieres for selected classes via classe_matieres
  const [classeMatieres, setClasseMatieres] = useState<any[]>([]);
  const activeClasseIds = form.classe_ids.length > 0 ? form.classe_ids : (form.classe_id ? [form.classe_id] : []);
  useEffect(() => {
    if (activeClasseIds.length === 0) { setClasseMatieres([]); return; }
    // Get matières for all selected classes and find common ones
    Promise.all(
      activeClasseIds.map(cid =>
        supabase.from('classe_matieres').select('matiere_id, matieres:matiere_id(id, nom)')
          .eq('classe_id', cid)
          .then(({ data }) => data || [])
      )
    ).then(results => {
      if (results.length === 1) {
        setClasseMatieres(results[0]);
      } else {
        // Find common matiere_ids across all classes
        const sets = results.map(r => new Set(r.map((m: any) => m.matiere_id)));
        const common = [...sets[0]].filter(id => sets.every(s => s.has(id)));
        setClasseMatieres(results[0].filter((m: any) => common.includes(m.matiere_id)));
      }
    });
  }, [JSON.stringify(activeClasseIds)]);

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
    const targetClasseIds = form.classe_ids;
    if (!form.titre || targetClasseIds.length === 0 || !form.matiere_id || !form.date_debut || !form.date_fin) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    if (form.type_composition === 'document' && !form.sujet_url && !editComp?.sujet_url) {
      toast.error('Veuillez uploader un fichier sujet (PDF ou Word)'); return;
    }
    const basePayload = {
      titre: form.titre, description: form.description || null,
      matiere_id: form.matiere_id,
      duree_minutes: form.duree_minutes, date_debut: form.date_debut,
      date_fin: form.date_fin, bareme: form.bareme,
      type_composition: form.type_composition,
      sujet_url: form.sujet_url || null,
      sujet_nom: form.sujet_nom || null,
    };

    if (editComp) {
      // Update the original composition
      const { error } = await supabase.from('compositions').update({ ...basePayload, classe_id: editComp.classe_id }).eq('id', editComp.id);
      if (error) { toast.error(error.message); return; }

      // Create copies for newly added classes (exclude original)
      const newClasseIds = targetClasseIds.filter(cid => cid !== editComp.classe_id);
      if (newClasseIds.length > 0) {
        const newRows = newClasseIds.map(cid => ({ ...basePayload, classe_id: cid }));
        const { data: inserted, error: insertErr } = await supabase.from('compositions').insert(newRows).select('id');
        if (insertErr) { toast.error(insertErr.message); return; }

        // Copy existing questions to new compositions
        const { data: existingQuestions } = await supabase.from('composition_questions')
          .select('type_question, enonce, options, reponse_correcte, points, ordre')
          .eq('composition_id', editComp.id);
        if (existingQuestions && existingQuestions.length > 0 && inserted) {
          const questionRows = inserted.flatMap((comp: any) =>
            existingQuestions.map((q: any) => ({ ...q, composition_id: comp.id }))
          );
          await supabase.from('composition_questions').insert(questionRows);
        }
        toast.success(`Composition modifiée + dupliquée vers ${newClasseIds.length} classe(s) supplémentaire(s)`);
      } else {
        toast.success('Composition modifiée');
      }
    } else {
      const rows = targetClasseIds.map(cid => ({ ...basePayload, classe_id: cid }));
      const { error } = await supabase.from('compositions').insert(rows).select('id');
      if (error) { toast.error(error.message); return; }
      toast.success(`Composition créée pour ${targetClasseIds.length} classe(s)`);
    }
    setShowForm(false); setEditComp(null);
    resetForm();
    fetchAll();
  }

  function resetForm() {
    setForm({ titre: '', description: '', classe_id: '', classe_ids: [], matiere_id: '', duree_minutes: 30, date_debut: '', date_fin: '', bareme: 20, type_composition: 'qcm', sujet_url: '', sujet_nom: '' });
  }

  async function togglePublie(comp: Composition) {
    if (!comp.publie) {
      if (comp.type_composition === 'qcm' || comp.type_composition === 'texte' || comp.type_composition === 'primaire_interactif' || comp.type_composition === 'geometrie_traces') {
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
    setQuestions((data || []).map((q: any) => {
      const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
      // Detect qcm_multiple: if reponse_correcte is a JSON array string and type is qcm
      let type_question = q.type_question;
      let reponse_correcte = q.reponse_correcte;
      if (q.type_question === 'qcm' && reponse_correcte) {
        try {
          const parsed = JSON.parse(reponse_correcte);
          if (Array.isArray(parsed) && parsed.length >= 2) {
            type_question = 'qcm_multiple';
            // Mark correct options
            for (const opt of opts) {
              opt.correct = parsed.includes(opt.label);
            }
          }
        } catch {}
      }
      return { ...q, type_question, options: opts, reponse_correcte };
    }));
    setQuestionsLoading(false);
  }

  function addQuestion(type: 'qcm' | 'qcm_multiple' | 'vrai_faux' | 'texte') {
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
      if (q.type_question === 'qcm_multiple') {
        const correctCount = q.options.filter(o => o.correct).length;
        if (correctCount < 3) { toast.error(`Question ${i + 1}: sélectionnez au moins 3 bonnes réponses pour un QCM Multiple`); return; }
      } else if (q.type_question !== 'texte' && !q.reponse_correcte) { toast.error(`Question ${i + 1}: réponse correcte requise`); return; }
      if ((q.type_question === 'qcm' || q.type_question === 'qcm_multiple') && q.options.some(o => !o.label.trim())) {
        toast.error(`Question ${i + 1}: toutes les options doivent être remplies`); return;
      }
    }
    await supabase.from('composition_questions').delete().eq('composition_id', showQuestions);
    const rows = questions.map((q, i) => ({
      composition_id: showQuestions,
      type_question: q.type_question === 'qcm_multiple' ? 'qcm' : q.type_question,
      enonce: q.enonce,
      options: q.type_question === 'qcm_multiple' ? q.options.map(o => ({ ...o })) : q.options,
      reponse_correcte: q.type_question === 'qcm_multiple'
        ? JSON.stringify(q.options.filter(o => o.correct).map(o => o.label))
        : q.reponse_correcte,
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

  async function openResultsByClass(compId: string) {
    setResultsByClassComp(compId);
    setResultsByClassLoading(true);
    const comp = compositions.find(c => c.id === compId);
    // Find all compositions with same titre (grouped across classes)
    const siblingComps = compositions.filter(c => c.titre === comp?.titre);
    const allResults: any[] = [];
    const classeIds = siblingComps.map(sc => sc.classe_id);
    
    // Fetch results and total students per class in parallel
    const [resultsArr, effectifRes] = await Promise.all([
      Promise.all(siblingComps.map(async sc => {
        const { data } = await supabase.from('composition_reponses')
          .select('*, eleves:eleve_id(nom, prenom, matricule, classe_id, classes:classe_id(nom, niveaux:niveau_id(nom)))')
          .eq('composition_id', sc.id)
          .order('score', { ascending: false });
        return (data || []).map((r: any) => ({ ...r, comp_classe: sc.classes?.nom, comp_id: sc.id, bareme: sc.bareme }));
      })),
      supabase.from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes:classe_id(nom, niveaux:niveau_id(nom))')
        .in('classe_id', classeIds)
        .eq('statut', 'inscrit')
        .is('deleted_at', null),
    ]);
    
    resultsArr.forEach(arr => allResults.push(...arr));
    setResultsByClassData(allResults);
    setResultsByClassEffectif(effectifRes.data || []);
    setResultsByClassLoading(false);
  }

  const filtered = filterClasse === 'all' ? compositions : compositions.filter(c => c.classe_id === filterClasse);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const currentResultComp = compositions.find(c => c.id === showResults);

  // Group resultsByClass data by class
  const resultsByClassGrouped = useMemo(() => {
    const map = new Map<string, any[]>();
    resultsByClassData.forEach(r => {
      const className = r.eleves?.classes?.nom || r.comp_classe || 'Sans classe';
      if (!map.has(className)) map.set(className, []);
      map.get(className)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [resultsByClassData]);

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + Compositions first */}
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
                            {comp.type_composition === 'geometrie_traces' ? '📐 Géométrie & Tracés' : comp.type_composition === 'primaire_interactif' ? '🎨 Primaire Interactif' : comp.type_composition === 'document' ? '📄 Document' : comp.type_composition === 'texte' ? '✍️ Texte' : '📝 QCM'}
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
                    {(comp.type_composition === 'qcm' || comp.type_composition === 'texte' || comp.type_composition === 'primaire_interactif' || comp.type_composition === 'geometrie_traces') && (
                      <Button variant="outline" size="sm" onClick={() => openQuestions(comp.id)}>
                        <FileQuestion className="h-4 w-4 mr-1" /> Questions
                      </Button>
                     )}
                     {comp.type_composition === 'geometrie_traces' && (
                       <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-600" onClick={() => window.open('/composition-geometrie', '_blank')}>
                         <Eye className="h-4 w-4 mr-1" /> Aperçu Géométrie
                       </Button>
                     )}
                    <Button variant="outline" size="sm" onClick={() => openResults(comp.id)}>
                      <Eye className="h-4 w-4 mr-1" /> Résultats
                    </Button>
                    <Button variant="outline" size="sm" className="border-primary/30 text-primary" onClick={() => openResultsByClass(comp.id)}>
                      <BarChart3 className="h-4 w-4 mr-1" /> Par classe
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditComp(comp);
                      setForm({
                        titre: comp.titre, description: comp.description || '',
                        classe_id: comp.classe_id, classe_ids: [comp.classe_id], matiere_id: comp.matiere_id,
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

      {/* Connected Students Dashboard - hidden for coordinateurs */}
      {!isCoordinateur && <ConnectedStudentsDashboard />}

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
                    {!isCoordSecondaire && (
                      <>
                        <SelectItem value="primaire_interactif">🎨 Primaire Interactif — Dessin + Math + QCM Audio</SelectItem>
                        <SelectItem value="geometrie_traces">📐 Géométrie & Tracés — Relier + Quadrillage</SelectItem>
                        <SelectItem value="dessin_visuel">🖌️ Dessin + Sujet Visuel — Forme à reproduire</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                {/* Type-specific guidance */}
                {form.type_composition === 'primaire_interactif' && (
                  <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm space-y-1">
                    <p className="font-semibold text-amber-700 dark:text-amber-400">🎨 Primaire Interactif</p>
                    <p className="text-muted-foreground text-xs">Ce type combine dessin sur canvas, mathématiques visuelles et QCM avec assistance vocale. Après la création :</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                      <li>Ajoutez des <strong>questions QCM</strong> qui seront lues à voix haute aux élèves</li>
                      <li>Les élèves pourront aussi dessiner sur un canvas interactif</li>
                      <li>Les résultats (score QCM + dessin) seront sauvegardés automatiquement</li>
                    </ul>
                  </div>
                )}
                {form.type_composition === 'geometrie_traces' && (
                  <div className="mt-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm space-y-1">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">📐 Géométrie & Tracés</p>
                    <p className="text-muted-foreground text-xs">Ce type propose 2 exercices interactifs :</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                      <li><strong>Relier les formes</strong> — L'élève relie les formes géométriques à leur nom (feedback haptique)</li>
                      <li><strong>Quadrillage Magique 5×5</strong> — L'élève reproduit une figure sur un quadrillage (magnétisme snap-to-grid)</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-1">Après la création, ajoutez des <strong>questions QCM</strong> pour la partie théorique. Les exercices interactifs sont générés automatiquement.</p>
                  </div>
                )}
                {form.type_composition === 'document' && (
                  <div className="mt-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm space-y-1">
                    <p className="font-semibold text-blue-700 dark:text-blue-400">📄 Document</p>
                    <p className="text-muted-foreground text-xs">Uploadez un fichier sujet (PDF ou Word). Les élèves verront le document et répondront en texte libre avec possibilité d'insérer des images et formules mathématiques.</p>
                  </div>
                )}
              </div>
            )}
            <div><Label>Titre *</Label><Input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div>
              <Label className="mb-2 block">
                Classes ciblées * 
                <span className="text-xs text-muted-foreground ml-1">({form.classe_ids.length} sélectionnée{form.classe_ids.length > 1 ? 's' : ''})</span>
                {editComp && <span className="text-[10px] text-primary ml-2">💡 Ajoutez des classes pour dupliquer le sujet + questions</span>}
              </Label>
              {form.classe_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.classe_ids.map(cid => {
                    const cl = classes.find((c: any) => c.id === cid);
                    const isOriginal = editComp && cid === editComp.classe_id;
                    return (
                      <Badge key={cid} variant={isOriginal ? 'default' : 'secondary'} className={`text-[10px] gap-1 ${isOriginal ? '' : 'cursor-pointer hover:bg-destructive/20'}`} onClick={() => {
                        if (isOriginal) return; // Can't remove the original class in edit mode
                        setForm({ ...form, classe_ids: form.classe_ids.filter(id => id !== cid), matiere_id: '' });
                      }}>
                        {cl?.niveaux?.nom} — {cl?.nom} {isOriginal ? '(original)' : '✕'}
                      </Badge>
                    );
                  })}
                  {!editComp && (
                    <button className="text-[10px] text-destructive hover:underline ml-1" onClick={() => setForm({ ...form, classe_ids: [], matiere_id: '' })}>
                      Tout effacer
                    </button>
                  )}
                </div>
              )}
              <div className="border rounded-lg max-h-52 overflow-y-auto bg-background">
                {(() => {
                  const grouped: Record<string, Record<string, typeof classes>> = {};
                  classes.forEach((c: any) => {
                    const cycle = c.niveaux?.cycles?.nom || 'Autre';
                    const niveau = c.niveaux?.nom || 'Autre';
                    if (!grouped[cycle]) grouped[cycle] = {};
                    if (!grouped[cycle][niveau]) grouped[cycle][niveau] = [];
                    grouped[cycle][niveau].push(c);
                  });
                  return Object.entries(grouped).map(([cycle, niveaux]) => (
                    <div key={cycle}>
                      <div className="px-3 py-1.5 bg-muted/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0">{cycle}</div>
                      {Object.entries(niveaux).map(([niveau, nClasses]) => {
                        const allSelected = nClasses.every((c: any) => form.classe_ids.includes(c.id));
                        const someSelected = nClasses.some((c: any) => form.classe_ids.includes(c.id));
                        return (
                          <div key={niveau}>
                            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 cursor-pointer border-b border-dashed">
                              <Checkbox
                                checked={allSelected}
                                className={someSelected && !allSelected ? 'opacity-60' : ''}
                                onCheckedChange={(checked) => {
                                  const niveauIds = nClasses.map((c: any) => c.id);
                                  let newIds = checked
                                    ? [...new Set([...form.classe_ids, ...niveauIds])]
                                    : form.classe_ids.filter(id => !niveauIds.includes(id));
                                  // Keep original class in edit mode
                                  if (editComp && !newIds.includes(editComp.classe_id)) newIds = [editComp.classe_id, ...newIds];
                                  setForm({ ...form, classe_ids: newIds, matiere_id: '' });
                                }}
                              />
                              <span className="text-xs font-semibold text-foreground">{niveau}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{nClasses.filter((c: any) => form.classe_ids.includes(c.id)).length}/{nClasses.length}</span>
                            </label>
                            <div className="pl-6 grid grid-cols-3 gap-1 py-1">
                              {nClasses.map((c: any) => {
                                const isOriginal = editComp && c.id === editComp.classe_id;
                                return (
                                  <label key={c.id} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/40 cursor-pointer text-sm">
                                    <Checkbox
                                      checked={form.classe_ids.includes(c.id)}
                                      disabled={isOriginal}
                                      onCheckedChange={(checked) => {
                                        const newIds = checked
                                          ? [...form.classe_ids, c.id]
                                          : form.classe_ids.filter(id => id !== c.id);
                                        setForm({ ...form, classe_ids: newIds, matiere_id: '' });
                                      }}
                                    />
                                    <span className="truncate">{c.nom}</span>
                                    {isOriginal && <span className="text-[10px] text-primary">(actuelle)</span>}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div>
              <Label>Matière {form.classe_ids.length > 1 ? 'commune' : ''} * {form.classe_ids.length === 0 && <span className="text-[10px] text-muted-foreground">(sélectionnez d'abord les classes)</span>}</Label>
              <Select value={form.matiere_id} onValueChange={v => setForm({ ...form, matiere_id: v })} disabled={form.classe_ids.length === 0}>
                <SelectTrigger><SelectValue placeholder={form.classe_ids.length === 0 ? 'Sélectionnez les classes d\'abord' : 'Choisir'} /></SelectTrigger>
                <SelectContent>
                  {classeMatieres.map((cm: any) => (
                    <SelectItem key={cm.matiere_id} value={cm.matiere_id}>{cm.matieres?.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        {q.type_question === 'qcm_multiple' ? 'QCM Multiple' : q.type_question === 'qcm' ? 'QCM' : q.type_question === 'texte' ? '✍️ Texte' : 'Vrai/Faux'} — Q{idx + 1}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Points:</Label>
                        <Input type="number" className="w-16 h-8" value={q.points} onChange={e => updateQuestion(idx, { points: Number(e.target.value) })} min={0.5} step={0.5} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeQuestion(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea placeholder="Énoncé de la question (utilisez $...$ pour les formules math, ex: $\frac{a}{b}$, $\sqrt{x}$, $\pi$)" value={q.enonce} onChange={e => updateQuestion(idx, { enonce: e.target.value })} rows={2} />
                    {q.enonce && /[\$\\]/.test(q.enonce) && (
                      <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                        <p className="text-[10px] text-muted-foreground mb-1">Aperçu :</p>
                        <p className="text-sm font-medium"><MathText text={q.enonce} /></p>
                      </div>
                    )}
                    {q.type_question === 'texte' ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Réponse attendue (référence pour la correction IA) :</Label>
                        <Textarea
                          placeholder="Saisissez la réponse attendue ou les idées clés que l'élève doit mentionner..."
                          value={q.reponse_correcte === '_texte_' ? '' : q.reponse_correcte}
                          onChange={e => updateQuestion(idx, { reponse_correcte: e.target.value || '_texte_' })}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground italic">
                          💡 L'IA comparera la réponse de l'élève avec cette référence et attribuera une note automatiquement.
                        </p>
                      </div>
                    ) : q.type_question === 'qcm_multiple' ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Cochez les bonnes réponses (minimum 3) :</Label>
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded border-muted-foreground"
                              checked={!!opt.correct}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                newOpts[oi] = { ...newOpts[oi], correct: e.target.checked };
                                updateQuestion(idx, { options: newOpts });
                              }}
                              id={`q${idx}_mc${oi}`}
                            />
                            <div className="flex-1 space-y-1">
                              <Input
                                className="h-8"
                                placeholder={`Option ${oi + 1}`}
                                value={opt.label}
                                onChange={e => {
                                  const newOpts = [...q.options];
                                  newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                                  updateQuestion(idx, { options: newOpts });
                                }}
                              />
                              {opt.label && /[\$\\]/.test(opt.label) && (
                                <span className="text-xs text-muted-foreground"><MathText text={opt.label} /></span>
                              )}
                            </div>
                            {opt.correct && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" onClick={() => {
                          updateQuestion(idx, { options: [...q.options, { label: '' }] });
                        }}>+ Ajouter une option</Button>
                      </div>
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
                                <div className="flex-1 space-y-1">
                                  <Input
                                    className="h-8"
                                    placeholder={`Option ${oi + 1} (ex: $\\frac{1}{2}$)`}
                                    value={opt.label}
                                    onChange={e => {
                                      const newOpts = [...q.options];
                                      const oldLabel = newOpts[oi].label;
                                      newOpts[oi] = { ...newOpts[oi], label: e.target.value };
                                      const updatedCorrect = q.reponse_correcte === oldLabel ? e.target.value : q.reponse_correcte;
                                      updateQuestion(idx, { options: newOpts, reponse_correcte: updatedCorrect });
                                    }}
                                  />
                                  {opt.label && /[\$\\]/.test(opt.label) && (
                                    <span className="text-xs text-muted-foreground"><MathText text={opt.label} /></span>
                                  )}
                                </div>
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
                        <Button variant="outline" onClick={() => addQuestion('qcm_multiple')}>
                          <Plus className="h-4 w-4 mr-1" /> QCM Multiple
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
                        {r.score != null ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">Note IA</Badge>
                            <Input type="number" placeholder="Corriger" className="w-20" min={0} max={currentResultComp.bareme}
                              id={`note-${r.id}`} defaultValue={r.score} />
                            <Button size="sm" variant="outline" onClick={async () => {
                              const noteEl = document.getElementById(`note-${r.id}`) as HTMLInputElement;
                              const note = Number(noteEl?.value);
                              if (isNaN(note)) { toast.error('Saisissez une note valide'); return; }
                              const { error } = await supabase.from('composition_reponses')
                                .update({ score: note } as any).eq('id', r.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success('Note corrigée');
                              openResults(showResults!);
                            }}>
                              Corriger
                            </Button>
                          </div>
                        ) : (
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

      {/* Results by Class Dialog */}
      <Dialog open={!!resultsByClassComp} onOpenChange={() => setResultsByClassComp(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Résultats par classe — {compositions.find(c => c.id === resultsByClassComp)?.titre}
              </DialogTitle>
              {resultsByClassGrouped.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1" /> Imprimer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const comp = compositions.find(c => c.id === resultsByClassComp);
                    import('@/lib/excelUtils').then(({ exportToExcel }) => {
                      const rows: any[] = [];
                      resultsByClassGrouped.forEach(([className, students]) => {
                        const classeEleves = resultsByClassEffectif.filter((e: any) => (e.classes?.nom || '') === className);
                        const composedIds = new Set(students.map((s: any) => s.eleve_id));
                        const nonComposed = classeEleves.filter((e: any) => !composedIds.has(e.id));
                        students.sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1)).forEach((r: any, i: number) => {
                          rows.push({ Classe: className, '#': i + 1, Prénom: r.eleves?.prenom, Nom: r.eleves?.nom, Matricule: r.eleves?.matricule, Note: r.score != null ? `${r.score}/${r.bareme}` : 'À noter', Statut: 'Composé', 'Soumis le': r.soumis_at ? new Date(r.soumis_at).toLocaleString('fr') : '' });
                        });
                        nonComposed.forEach((e: any) => {
                          rows.push({ Classe: className, '#': '', Prénom: e.prenom, Nom: e.nom, Matricule: e.matricule, Note: '', Statut: 'Non composé', 'Soumis le': '' });
                        });
                      });
                      exportToExcel(rows, `Résultats_${comp?.titre || 'composition'}`);
                    });
                  }}>
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {resultsByClassLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : resultsByClassGrouped.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun résultat pour cette composition</p>
          ) : (
            <div className="space-y-6 print:space-y-4" id="results-by-class-print">
              {/* Global best per niveau */}
              {(() => {
                const niveauMap = new Map<string, { student: any; score: number; className: string; bareme: number }>();
                resultsByClassGrouped.forEach(([className, students]) => {
                  students.forEach((s: any) => {
                    const niveau = s.eleves?.classes?.niveaux?.nom || '';
                    if (niveau && s.score != null) {
                      const existing = niveauMap.get(niveau);
                      if (!existing || s.score > existing.score) {
                        niveauMap.set(niveau, { student: s, score: s.score, className, bareme: s.bareme });
                      }
                    }
                  });
                });
                if (niveauMap.size > 0) {
                  return (
                    <Card className="border-2 border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Meilleure note par niveau</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Array.from(niveauMap.entries()).map(([niveau, { student, score, className, bareme }]) => (
                            <div key={niveau} className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Trophy className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground">{niveau}</p>
                                <p className="font-semibold text-sm truncate">{student.eleves?.prenom} {student.eleves?.nom}</p>
                                <p className="text-xs text-muted-foreground">{className} — <strong className="text-primary">{score}/{bareme}</strong></p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                return null;
              })()}

              {resultsByClassGrouped.map(([className, students]) => {
                const scored = students.filter((s: any) => s.score != null);
                const avg = scored.length > 0 ? (scored.reduce((sum: number, s: any) => sum + s.score, 0) / scored.length).toFixed(1) : '—';
                const max = scored.length > 0 ? Math.max(...scored.map((s: any) => s.score)) : '—';
                const min = scored.length > 0 ? Math.min(...scored.map((s: any) => s.score)) : '—';
                const bareme = students[0]?.bareme || 20;
                const bestStudent = scored.length > 0 ? scored.reduce((best: any, s: any) => (s.score > (best?.score ?? -1) ? s : best), null) : null;
                
                // Effectif: composed vs not composed
                const classeEleves = resultsByClassEffectif.filter((e: any) => (e.classes?.nom || '') === className);
                const composedIds = new Set(students.map((s: any) => s.eleve_id));
                const nonComposed = classeEleves.filter((e: any) => !composedIds.has(e.id));
                const totalEffectif = classeEleves.length || students.length;
                
                return (
                  <Card key={className} className="border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          {className}
                        </CardTitle>
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <Badge variant="default" className="text-xs">{students.length}/{totalEffectif} composé{students.length > 1 ? 's' : ''}</Badge>
                          {nonComposed.length > 0 && <Badge variant="destructive" className="text-xs">{nonComposed.length} absent{nonComposed.length > 1 ? 's' : ''}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm mt-1 flex-wrap">
                        <span className="text-muted-foreground">Moy: <strong className="text-foreground">{avg}/{bareme}</strong></span>
                        <span className="text-muted-foreground">Max: <strong className="text-emerald-600 dark:text-emerald-400">{max}</strong></span>
                        <span className="text-muted-foreground">Min: <strong className="text-destructive">{min}</strong></span>
                        {bestStudent && (
                          <span className="flex items-center gap-1 text-primary">
                            <Trophy className="h-3.5 w-3.5" />
                            <strong>{bestStudent.eleves?.prenom} {bestStudent.eleves?.nom}</strong>
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8">#</TableHead>
                            <TableHead>Élève</TableHead>
                            <TableHead>Matricule</TableHead>
                            <TableHead className="text-right">Note</TableHead>
                            <TableHead className="text-right">Soumis le</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1)).map((r: any, i: number) => (
                            <TableRow key={r.id} className={i === 0 && r.score != null ? 'bg-primary/5' : ''}>
                              <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                              <TableCell className="font-medium">
                                {i === 0 && r.score != null && <Trophy className="h-3.5 w-3.5 inline mr-1 text-primary" />}
                                {r.eleves?.prenom} {r.eleves?.nom}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.eleves?.matricule}</TableCell>
                              <TableCell className="text-right">
                                {r.score != null ? (
                                  <Badge variant={r.score >= bareme * 0.5 ? 'default' : 'destructive'} className="text-xs">
                                    {r.score}/{bareme}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">À noter</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">
                                {r.soumis_at ? new Date(r.soumis_at).toLocaleString('fr') : 'En cours...'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      {nonComposed.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs font-medium text-destructive cursor-pointer flex items-center gap-1">
                            ⚠️ {nonComposed.length} élève{nonComposed.length > 1 ? 's' : ''} n'ayant pas composé
                          </summary>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {nonComposed.map((e: any) => (
                              <div key={e.id} className="text-xs text-muted-foreground px-2 py-1 rounded bg-destructive/5 border border-destructive/10">
                                {e.prenom} {e.nom} <span className="opacity-60">({e.matricule})</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}