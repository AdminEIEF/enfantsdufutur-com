import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, FileText, Plus, Trash2, BookOpen, Search, Loader2, Upload, CirclePlus, CircleMinus, FileType, ListChecks, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { sortClasses } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { DevoirSoumissionsDialog } from '@/components/DevoirSoumissionsDialog';

interface QuizQuestion {
  question: string;
  type: 'choix_multiple' | 'vrai_faux';
  options: { label: string; correct: boolean }[];
  points: number;
}

export default function CoursAdmin() {
  const [tab, setTab] = useState('cours');
  const [filterClasse, setFilterClasse] = useState('all');
  const [search, setSearch] = useState('');
  const [openCours, setOpenCours] = useState(false);
  const [openDevoir, setOpenDevoir] = useState(false);
  const [viewDevoir, setViewDevoir] = useState<any>(null);
  const qc = useQueryClient();

  // Form states - Cours
  const [cTitre, setCTitre] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cMatiereId, setCMatiereId] = useState('');
  const [cClasseId, setCClasseId] = useState('');
  const [cTypeContenu, setCTypeContenu] = useState('pdf');
  const [cUrl, setCUrl] = useState('');
  const [cFile, setCFile] = useState<File | null>(null);
  const [cUploading, setCUploading] = useState(false);
  const cFileRef = useRef<HTMLInputElement>(null);

  // Form states - Devoir
  const [dTitre, setDTitre] = useState('');
  const [dDescription, setDDescription] = useState('');
  const [dMatiereId, setDMatiereId] = useState('');
  const [dClasseId, setDClasseId] = useState('');
  const [dDateLimite, setDDateLimite] = useState('');
  const [dNoteMax, setDNoteMax] = useState('20');
  const [dTypeDevoir, setDTypeDevoir] = useState('fichier');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, ordre, cycle_id, cycles:cycle_id(nom, ordre))');
      if (error) throw error;
      return sortClasses(data || []);
    },
  });

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: cours = [], isLoading: loadingCours } = useQuery({
    queryKey: ['admin-cours'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cours').select('*, matieres:matiere_id(nom), classes:classe_id(nom)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: devoirs = [], isLoading: loadingDevoirs } = useQuery({
    queryKey: ['admin-devoirs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devoirs').select('*, matieres:matiere_id(nom), classes:classe_id(nom)').order('date_limite', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      const { error } = await supabase.from('cours').update({ visible } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cours'] });
      toast({ title: 'Visibilité mise à jour' });
    },
  });

  const createCours = useMutation({
    mutationFn: async () => {
      if (!cTitre.trim() || !cMatiereId || !cClasseId) throw new Error('Champs obligatoires manquants');

      let finalUrl = cUrl.trim();

      // If file upload type (word or pdf-upload), upload the file
      if ((cTypeContenu === 'word' || cTypeContenu === 'pdf') && cFile) {
        setCUploading(true);
        const ext = cFile.name.split('.').pop();
        const fileName = `cours/${cClasseId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('cours').upload(fileName, cFile);
        if (uploadErr) throw uploadErr;
        const { data: signedData } = await supabase.storage.from('cours').createSignedUrl(fileName, 31536000);
        finalUrl = signedData?.signedUrl || '';
        setCUploading(false);
      }

      if (!finalUrl) throw new Error('URL ou fichier manquant');

      const { error } = await supabase.from('cours').insert({
        titre: cTitre.trim(),
        description: cDescription.trim() || null,
        matiere_id: cMatiereId,
        classe_id: cClasseId,
        type_contenu: cTypeContenu,
        contenu_url: finalUrl,
        fichier_nom: cFile?.name || null,
        visible: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cours'] });
      toast({ title: 'Cours ajouté' });
      setOpenCours(false);
      setCTitre(''); setCDescription(''); setCMatiereId(''); setCClasseId(''); setCUrl(''); setCTypeContenu('pdf'); setCFile(null);
    },
    onError: (e: Error) => {
      setCUploading(false);
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    },
  });

  const createDevoir = useMutation({
    mutationFn: async () => {
      if (!dTitre.trim() || !dMatiereId || !dClasseId || !dDateLimite) throw new Error('Champs obligatoires manquants');

      if (dTypeDevoir === 'quiz' && quizQuestions.length === 0) throw new Error('Ajoutez au moins une question');

      // Validate quiz questions
      if (dTypeDevoir === 'quiz') {
        for (const q of quizQuestions) {
          if (!q.question.trim()) throw new Error('Toutes les questions doivent avoir un intitulé');
          if (q.type === 'choix_multiple' && q.options.length < 2) throw new Error('Au moins 2 options par question');
          if (!q.options.some(o => o.correct)) throw new Error(`La question "${q.question}" n'a pas de bonne réponse`);
        }
      }

      const totalPoints = dTypeDevoir === 'quiz' 
        ? quizQuestions.reduce((s, q) => s + q.points, 0) 
        : Number(dNoteMax) || 20;

      const { data: devoir, error } = await supabase.from('devoirs').insert({
        titre: dTitre.trim(),
        description: dDescription.trim() || null,
        matiere_id: dMatiereId,
        classe_id: dClasseId,
        date_limite: dDateLimite,
        note_max: totalPoints,
        type_devoir: dTypeDevoir,
      } as any).select('id').single();
      if (error) throw error;

      // Insert quiz questions
      if (dTypeDevoir === 'quiz' && devoir) {
        const questions = quizQuestions.map((q, i) => ({
          devoir_id: devoir.id,
          question: q.question.trim(),
          type: q.type,
          options: q.options,
          points: q.points,
          ordre: i,
        }));
        const { error: qErr } = await supabase.from('quiz_questions').insert(questions as any);
        if (qErr) throw qErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devoirs'] });
      toast({ title: 'Devoir ajouté' });
      setOpenDevoir(false);
      setDTitre(''); setDDescription(''); setDMatiereId(''); setDClasseId(''); setDDateLimite(''); setDNoteMax('20');
      setDTypeDevoir('fichier'); setQuizQuestions([]);
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteCours = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cours').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cours'] });
      toast({ title: 'Cours supprimé' });
    },
  });

  const deleteDevoir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('devoirs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devoirs'] });
      toast({ title: 'Devoir supprimé' });
    },
  });

  const filteredCours = cours.filter((c: any) => {
    const matchClasse = filterClasse === 'all' || c.classe_id === filterClasse;
    const matchSearch = !search || c.titre.toLowerCase().includes(search.toLowerCase());
    return matchClasse && matchSearch;
  });

  const filteredDevoirs = devoirs.filter((d: any) => {
    const matchClasse = filterClasse === 'all' || d.classe_id === filterClasse;
    const matchSearch = !search || d.titre.toLowerCase().includes(search.toLowerCase());
    return matchClasse && matchSearch;
  });

  // Quiz question helpers
  const addQuestion = () => {
    setQuizQuestions([...quizQuestions, {
      question: '',
      type: 'choix_multiple',
      options: [{ label: '', correct: false }, { label: '', correct: false }],
      points: 1,
    }]);
  };

  const removeQuestion = (idx: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, field: string, value: any) => {
    const updated = [...quizQuestions];
    (updated[idx] as any)[field] = value;
    if (field === 'type' && value === 'vrai_faux') {
      updated[idx].options = [{ label: 'Vrai', correct: true }, { label: 'Faux', correct: false }];
    }
    setQuizQuestions(updated);
  };

  const updateOption = (qIdx: number, oIdx: number, field: string, value: any) => {
    const updated = [...quizQuestions];
    (updated[qIdx].options[oIdx] as any)[field] = value;
    setQuizQuestions(updated);
  };

  const addOption = (qIdx: number) => {
    const updated = [...quizQuestions];
    if (updated[qIdx].options.length < 6) {
      updated[qIdx].options.push({ label: '', correct: false });
      setQuizQuestions(updated);
    }
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const updated = [...quizQuestions];
    if (updated[qIdx].options.length > 2) {
      updated[qIdx].options.splice(oIdx, 1);
      setQuizQuestions(updated);
    }
  };

  const needsFileUpload = cTypeContenu === 'word' || cTypeContenu === 'pdf';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-primary" /> Cours & Devoirs
      </h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cours">Cours ({filteredCours.length})</TabsTrigger>
          <TabsTrigger value="devoirs">Devoirs ({filteredDevoirs.length})</TabsTrigger>
        </TabsList>

        {/* COURS TAB */}
        <TabsContent value="cours" className="space-y-4 mt-3">
          <div className="flex justify-end">
            <Dialog open={openCours} onOpenChange={setOpenCours}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Ajouter un cours</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nouveau cours</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titre *</Label><Input value={cTitre} onChange={e => setCTitre(e.target.value)} /></div>
                  <div><Label>Description</Label><Input value={cDescription} onChange={e => setCDescription(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Classe *</Label>
                      <Select value={cClasseId} onValueChange={setCClasseId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Matière *</Label>
                      <Select value={cMatiereId} onValueChange={setCMatiereId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Type de contenu</Label>
                    <Select value={cTypeContenu} onValueChange={(v) => { setCTypeContenu(v); setCFile(null); setCUrl(''); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">📄 Fichier PDF</SelectItem>
                        <SelectItem value="word">📝 Fichier Word (.docx)</SelectItem>
                        <SelectItem value="video">🎬 Vidéo (YouTube/Vimeo/MP4)</SelectItem>
                        <SelectItem value="lien">🔗 Lien externe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {needsFileUpload ? (
                    <div>
                      <Label>Fichier {cTypeContenu === 'word' ? 'Word' : 'PDF'} *</Label>
                      <input
                        ref={cFileRef}
                        type="file"
                        className="hidden"
                        accept={cTypeContenu === 'word' ? '.doc,.docx' : '.pdf'}
                        onChange={e => { if (e.target.files?.[0]) setCFile(e.target.files[0]); }}
                      />
                      <div className="mt-1 flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => cFileRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-1" /> Choisir un fichier
                        </Button>
                        {cFile && <span className="text-sm text-muted-foreground truncate max-w-[200px]">{cFile.name}</span>}
                      </div>
                    </div>
                  ) : (
                    <div><Label>URL du contenu *</Label><Input value={cUrl} onChange={e => setCUrl(e.target.value)} placeholder={cTypeContenu === 'video' ? 'https://youtube.com/watch?v=...' : 'https://...'} /></div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCours(false)}>Annuler</Button>
                  <Button onClick={() => createCours.mutate()} disabled={createCours.isPending || cUploading}>
                    {(createCours.isPending || cUploading) ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Upload...</> : 'Ajouter'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Visible</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCours ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredCours.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun cours</TableCell></TableRow>
                  ) : filteredCours.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.titre}</TableCell>
                      <TableCell>{(c.matieres as any)?.nom || '—'}</TableCell>
                      <TableCell>{(c.classes as any)?.nom || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {c.type_contenu === 'video' ? <Video className="h-3 w-3" /> :
                           c.type_contenu === 'word' ? <FileType className="h-3 w-3" /> :
                           <FileText className="h-3 w-3" />}
                          {c.type_contenu}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.visible !== false}
                          onCheckedChange={(checked) => toggleVisibility.mutate({ id: c.id, visible: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteCours.mutate(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEVOIRS TAB */}
        <TabsContent value="devoirs" className="space-y-4 mt-3">
          <div className="flex justify-end">
            <Dialog open={openDevoir} onOpenChange={setOpenDevoir}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Ajouter un devoir</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nouveau devoir</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titre *</Label><Input value={dTitre} onChange={e => setDTitre(e.target.value)} /></div>
                  <div><Label>Description</Label><Input value={dDescription} onChange={e => setDDescription(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Classe *</Label>
                      <Select value={dClasseId} onValueChange={setDClasseId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Matière *</Label>
                      <Select value={dMatiereId} onValueChange={setDMatiereId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date limite *</Label><Input type="datetime-local" value={dDateLimite} onChange={e => setDDateLimite(e.target.value)} /></div>
                    {dTypeDevoir === 'fichier' && (
                      <div><Label>Note max</Label><Input type="number" value={dNoteMax} onChange={e => setDNoteMax(e.target.value)} /></div>
                    )}
                  </div>

                  {/* Type de devoir */}
                  <div>
                    <Label>Type de devoir</Label>
                    <RadioGroup value={dTypeDevoir} onValueChange={setDTypeDevoir} className="flex gap-4 mt-1">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="fichier" id="type-fichier" />
                        <Label htmlFor="type-fichier" className="flex items-center gap-1 cursor-pointer">
                          <Upload className="h-4 w-4" /> Soumission fichier
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="quiz" id="type-quiz" />
                        <Label htmlFor="type-quiz" className="flex items-center gap-1 cursor-pointer">
                          <ListChecks className="h-4 w-4" /> Quiz en ligne
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Quiz builder */}
                  {dTypeDevoir === 'quiz' && (
                    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Questions du quiz ({quizQuestions.length})</h3>
                        <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
                          <CirclePlus className="h-4 w-4 mr-1" /> Ajouter
                        </Button>
                      </div>
                      {quizQuestions.map((q, qi) => (
                        <Card key={qi}>
                          <CardContent className="py-3 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="shrink-0">Q{qi + 1}</Badge>
                                  <Input
                                    value={q.question}
                                    onChange={e => updateQuestion(qi, 'question', e.target.value)}
                                    placeholder="Intitulé de la question"
                                    className="flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-3">
                                  <Select value={q.type} onValueChange={v => updateQuestion(qi, 'type', v)}>
                                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="choix_multiple">Choix multiple</SelectItem>
                                      <SelectItem value="vrai_faux">Vrai / Faux</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="flex items-center gap-1">
                                    <Label className="text-xs whitespace-nowrap">Points :</Label>
                                    <Input type="number" min={1} max={20} value={q.points} onChange={e => updateQuestion(qi, 'points', Number(e.target.value) || 1)} className="w-16" />
                                  </div>
                                </div>
                              </div>
                              <Button type="button" size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeQuestion(qi)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Options */}
                            <div className="space-y-2 pl-6">
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <Checkbox
                                    checked={opt.correct}
                                    onCheckedChange={(checked) => updateOption(qi, oi, 'correct', !!checked)}
                                  />
                                  <Input
                                    value={opt.label}
                                    onChange={e => updateOption(qi, oi, 'label', e.target.value)}
                                    placeholder={`Option ${oi + 1}`}
                                    className="flex-1"
                                    disabled={q.type === 'vrai_faux'}
                                  />
                                  {q.type === 'choix_multiple' && q.options.length > 2 && (
                                    <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(qi, oi)}>
                                      <CircleMinus className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {q.type === 'choix_multiple' && q.options.length < 6 && (
                                <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={() => addOption(qi)}>
                                  <CirclePlus className="h-3 w-3 mr-1" /> Option
                                </Button>
                              )}
                              <p className="text-xs text-muted-foreground">✅ Cochez la/les bonne(s) réponse(s)</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {quizQuestions.length > 0 && (
                        <p className="text-sm text-muted-foreground text-right">
                          Total : {quizQuestions.reduce((s, q) => s + q.points, 0)} points
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenDevoir(false)}>Annuler</Button>
                  <Button onClick={() => createDevoir.mutate()} disabled={createDevoir.isPending}>
                    {createDevoir.isPending ? 'Ajout...' : 'Ajouter'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date limite</TableHead>
                    <TableHead>Note max</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDevoirs ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredDevoirs.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun devoir</TableCell></TableRow>
                  ) : filteredDevoirs.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.titre}</TableCell>
                      <TableCell>{(d.matieres as any)?.nom || '—'}</TableCell>
                      <TableCell>{(d.classes as any)?.nom || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={d.type_devoir === 'quiz' ? 'default' : 'outline'} className="gap-1">
                          {d.type_devoir === 'quiz' ? <ListChecks className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                          {d.type_devoir === 'quiz' ? 'Quiz' : 'Fichier'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(d.date_limite).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{d.note_max}</TableCell>
                      <TableCell className="text-right flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setViewDevoir(d)} title="Voir soumissions">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDevoir.mutate(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {viewDevoir && (
        <DevoirSoumissionsDialog
          devoir={viewDevoir}
          open={!!viewDevoir}
          onOpenChange={(open) => { if (!open) setViewDevoir(null); }}
        />
      )}
    </div>
  );
}
