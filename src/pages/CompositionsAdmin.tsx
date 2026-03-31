import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Edit, Eye, Loader2, FileQuestion, CheckCircle2, Clock, GripVertical } from 'lucide-react';

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
  classes?: { nom: string };
  matieres?: { nom: string };
}

interface Question {
  id?: string;
  composition_id?: string;
  type_question: 'qcm' | 'vrai_faux';
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

  // Form state
  const [form, setForm] = useState({
    titre: '', description: '', classe_id: '', matiere_id: '',
    duree_minutes: 30, date_debut: '', date_fin: '', bareme: 20,
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

  async function handleSave() {
    if (!form.titre || !form.classe_id || !form.matiere_id || !form.date_debut || !form.date_fin) {
      toast.error('Remplissez tous les champs obligatoires'); return;
    }
    const payload = {
      titre: form.titre, description: form.description || null,
      classe_id: form.classe_id, matiere_id: form.matiere_id,
      duree_minutes: form.duree_minutes, date_debut: form.date_debut,
      date_fin: form.date_fin, bareme: form.bareme,
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
    setForm({ titre: '', description: '', classe_id: '', matiere_id: '', duree_minutes: 30, date_debut: '', date_fin: '', bareme: 20 });
    fetchAll();
  }

  async function togglePublie(comp: Composition) {
    // Check if there are questions before publishing
    if (!comp.publie) {
      const { count } = await supabase.from('composition_questions').select('id', { count: 'exact', head: true }).eq('composition_id', comp.id);
      if (!count || count === 0) {
        toast.error('Ajoutez des questions avant de publier'); return;
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

  function addQuestion(type: 'qcm' | 'vrai_faux') {
    const newQ: Question = {
      type_question: type,
      enonce: '',
      options: type === 'vrai_faux'
        ? [{ label: 'Vrai' }, { label: 'Faux' }]
        : [{ label: '' }, { label: '' }, { label: '' }, { label: '' }],
      reponse_correcte: '',
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
    // Validate
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.enonce.trim()) { toast.error(`Question ${i + 1}: énoncé requis`); return; }
      if (!q.reponse_correcte) { toast.error(`Question ${i + 1}: réponse correcte requise`); return; }
      if (q.type_question === 'qcm' && q.options.some(o => !o.label.trim())) {
        toast.error(`Question ${i + 1}: toutes les options doivent être remplies`); return;
      }
    }
    // Delete existing
    await supabase.from('composition_questions').delete().eq('composition_id', showQuestions);
    // Insert new
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
    const { data } = await supabase.from('composition_reponses')
      .select('*, eleves:eleve_id(nom, prenom, matricule)')
      .eq('composition_id', compId)
      .order('score', { ascending: false });
    setResults(data || []);
  }

  const filtered = filterClasse === 'all' ? compositions : compositions.filter(c => c.classe_id === filterClasse);
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compositions en ligne</h1>
          <p className="text-sm text-muted-foreground">Gérer les examens QCM et Vrai/Faux</p>
        </div>
        <Button onClick={() => { setEditComp(null); setForm({ titre: '', description: '', classe_id: '', matiere_id: '', duree_minutes: 30, date_debut: '', date_fin: '', bareme: 20 }); setShowForm(true); }}>
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
                      {comp.publie ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Publiée</Badge>
                      ) : (
                        <Badge variant="secondary">Brouillon</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(comp as any).classes?.nom} • {(comp as any).matieres?.nom} • {comp.duree_minutes} min • /{comp.bareme}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(comp.date_debut).toLocaleDateString('fr')} → {new Date(comp.date_fin).toLocaleDateString('fr')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => openQuestions(comp.id)}>
                      <FileQuestion className="h-4 w-4 mr-1" /> Questions
                    </Button>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button onClick={handleSave}>{editComp ? 'Modifier' : 'Créer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
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
                      <Badge variant="outline">{q.type_question === 'qcm' ? 'QCM' : 'Vrai/Faux'} — Q{idx + 1}</Badge>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Points:</Label>
                        <Input type="number" className="w-16 h-8" value={q.points} onChange={e => updateQuestion(idx, { points: Number(e.target.value) })} min={0.5} step={0.5} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeQuestion(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Textarea placeholder="Énoncé de la question" value={q.enonce} onChange={e => updateQuestion(idx, { enonce: e.target.value })} rows={2} />
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
                  </CardContent>
                </Card>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => addQuestion('qcm')}>
                  <Plus className="h-4 w-4 mr-1" /> QCM
                </Button>
                <Button variant="outline" onClick={() => addQuestion('vrai_faux')}>
                  <Plus className="h-4 w-4 mr-1" /> Vrai/Faux
                </Button>
              </div>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Résultats</DialogTitle></DialogHeader>
          {results.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun élève n'a encore passé cette composition</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {results.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{r.eleves?.prenom} {r.eleves?.nom}</p>
                    <p className="text-xs text-muted-foreground">{r.eleves?.matricule}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{r.score ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.soumis_at ? new Date(r.soumis_at).toLocaleString('fr') : 'En cours...'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
