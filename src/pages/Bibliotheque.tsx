import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library, Search, User, Award, BarChart3, FileText, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

// ─── Hooks ───────────────────────────────────────────────
function useCycles() {
  return useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

function useNiveaux(cycleId: string) {
  return useQuery({
    queryKey: ['niveaux', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('niveaux').select('*').eq('cycle_id', cycleId).order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

function useClasses(niveauId: string) {
  return useQuery({
    queryKey: ['classes-niveau', niveauId],
    enabled: !!niveauId,
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*').eq('niveau_id', niveauId).order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function useElevesClasse(classeId: string) {
  return useQuery({
    queryKey: ['eleves-biblio', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, date_naissance, sexe, photo_url, statut, classe_id, classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom)))')
        .eq('classe_id', classeId)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function useEleveNotes(eleveId: string) {
  return useQuery({
    queryKey: ['notes-biblio', eleveId],
    enabled: !!eleveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*, matieres(nom, pole, coefficient), periodes(nom, ordre, est_rattrapage)')
        .eq('eleve_id', eleveId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

function usePeriodes() {
  return useQuery({
    queryKey: ['periodes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periodes').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────
const DEFAULT_POLES = ['Sciences', 'Langues', 'Arts', 'Sport', 'Éveil', 'Technique'];

function computeRadar(notes: any[]) {
  const poleMap: Record<string, { total: number; coefTotal: number }> = {};
  for (const n of notes) {
    if (n.note == null || !n.matieres?.pole) continue;
    const pole = n.matieres.pole;
    const coef = Number(n.matieres.coefficient) || 1;
    if (!poleMap[pole]) poleMap[pole] = { total: 0, coefTotal: 0 };
    poleMap[pole].total += Number(n.note) * coef;
    poleMap[pole].coefTotal += coef;
  }
  return DEFAULT_POLES
    .filter(pole => poleMap[pole])
    .map(pole => ({
      pole,
      moyenne: poleMap[pole].coefTotal > 0 ? poleMap[pole].total / poleMap[pole].coefTotal : 0,
      fullMark: 20,
    }));
}

function computeAvgByPeriode(notes: any[], periodes: any[]) {
  const map: Record<string, { total: number; coef: number }> = {};
  for (const n of notes) {
    if (n.note == null) continue;
    const pid = n.periode_id;
    const coef = Number(n.matieres?.coefficient) || 1;
    if (!map[pid]) map[pid] = { total: 0, coef: 0 };
    map[pid].total += Number(n.note) * coef;
    map[pid].coef += coef;
  }
  return periodes.map((p: any) => ({
    periode: p.nom,
    ordre: p.ordre,
    est_rattrapage: p.est_rattrapage,
    moyenne: map[p.id] ? map[p.id].total / map[p.id].coef : null,
  }));
}

export default function Bibliotheque() {
  const { data: cycles = [] } = useCycles();
  const [cycleId, setCycleId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEleveId, setSelectedEleveId] = useState('');
  const [dossierOpen, setDossierOpen] = useState(false);

  const { data: niveaux = [] } = useNiveaux(cycleId);
  const { data: classes = [] } = useClasses(niveauId);
  const { data: eleves = [] } = useElevesClasse(classeId);
  const { data: eleveNotes = [] } = useEleveNotes(selectedEleveId);
  const { data: periodes = [] } = usePeriodes();

  const selectedEleve = eleves.find((e: any) => e.id === selectedEleveId);

  const filtered = eleves.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  // Radar data for selected student (all notes)
  const radarData = useMemo(() => computeRadar(eleveNotes), [eleveNotes]);

  // Averages per period
  const periodeAverages = useMemo(() => computeAvgByPeriode(eleveNotes, periodes), [eleveNotes, periodes]);

  // General average (non-rattrapage periods)
  const moyenneGenerale = useMemo(() => {
    const regular = periodeAverages.filter(p => !p.est_rattrapage && p.moyenne !== null);
    if (regular.length === 0) return null;
    return regular.reduce((s, p) => s + (p.moyenne || 0), 0) / regular.length;
  }, [periodeAverages]);

  // Matière breakdown
  const matiereDetails = useMemo(() => {
    const map: Record<string, { nom: string; pole: string; total: number; count: number; coef: number }> = {};
    for (const n of eleveNotes) {
      if (n.note == null) continue;
      const mid = n.matiere_id;
      if (!map[mid]) map[mid] = { nom: n.matieres?.nom || '?', pole: n.matieres?.pole || '—', total: 0, count: 0, coef: Number(n.matieres?.coefficient) || 1 };
      map[mid].total += Number(n.note);
      map[mid].count += 1;
    }
    return Object.values(map)
      .map(m => ({ ...m, moyenne: m.count > 0 ? m.total / m.count : 0 }))
      .sort((a, b) => b.moyenne - a.moyenne);
  }, [eleveNotes]);

  const openDossier = (eleveId: string) => {
    setSelectedEleveId(eleveId);
    setDossierOpen(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Library className="h-7 w-7 text-primary" /> Bibliothèque Numérique
      </h1>

      {/* Navigation Cycle > Niveau > Classe */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Cycle</Label>
              <Select value={cycleId} onValueChange={(v) => { setCycleId(v); setNiveauId(''); setClasseId(''); }}>
                <SelectTrigger><SelectValue placeholder="Choisir un cycle" /></SelectTrigger>
                <SelectContent>
                  {cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Niveau</Label>
              <Select value={niveauId} onValueChange={(v) => { setNiveauId(v); setClasseId(''); }}>
                <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                <SelectContent>
                  {niveaux.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Aucun niveau</SelectItem>
                  ) : niveaux.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Classe</Label>
              <Select value={classeId} onValueChange={setClasseId}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {classes.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Aucune classe</SelectItem>
                  ) : classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rechercher</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nom, prénom, matricule…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      {classeId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Élèves ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Sexe</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-32">Dossier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun élève dans cette classe</TableCell>
                  </TableRow>
                ) : filtered.map((e: any) => (
                  <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDossier(e.id)}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {e.prenom} {e.nom}
                    </TableCell>
                    <TableCell>{e.matricule || '—'}</TableCell>
                    <TableCell>{e.sexe || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={e.statut === 'inscrit' ? 'default' : e.statut === 'réinscrit' ? 'secondary' : 'outline'}>
                        {e.statut}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4 mr-1" /> Ouvrir <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Library className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Sélectionnez un Cycle, un Niveau puis une Classe pour consulter les dossiers élèves</p>
          </CardContent>
        </Card>
      )}

      {/* Dossier Élève Dialog */}
      <Dialog open={dossierOpen} onOpenChange={(open) => { setDossierOpen(open); if (!open) setSelectedEleveId(''); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Livret Unique — {selectedEleve?.prenom} {selectedEleve?.nom}
            </DialogTitle>
          </DialogHeader>

          {selectedEleve && (
            <Tabs defaultValue="synthese" className="mt-2">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="synthese">Synthèse</TabsTrigger>
                <TabsTrigger value="notes">Notes & Bulletins</TabsTrigger>
                <TabsTrigger value="radar">Profil Radar</TabsTrigger>
              </TabsList>

              {/* ── Synthèse ── */}
              <TabsContent value="synthese" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Nom complet</p>
                    <p className="font-medium">{selectedEleve.prenom} {selectedEleve.nom}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Matricule</p>
                    <p className="font-medium">{selectedEleve.matricule || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Date de naissance</p>
                    <p className="font-medium">{selectedEleve.date_naissance ? new Date(selectedEleve.date_naissance).toLocaleDateString('fr-FR') : '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Sexe</p>
                    <p className="font-medium">{selectedEleve.sexe || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Classe actuelle</p>
                    <p className="font-medium">{selectedEleve.classes?.niveaux?.cycles?.nom} — {selectedEleve.classes?.niveaux?.nom} — {selectedEleve.classes?.nom}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Statut</p>
                    <Badge variant={selectedEleve.statut === 'inscrit' ? 'default' : 'secondary'}>{selectedEleve.statut}</Badge>
                  </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <Card className="border-primary/30">
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Moyenne Générale</p>
                      <p className={`text-xl font-bold ${moyenneGenerale !== null && moyenneGenerale >= 10 ? 'text-accent' : 'text-destructive'}`}>
                        {moyenneGenerale !== null ? `${moyenneGenerale.toFixed(2)}/20` : '—'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Matières évaluées</p>
                      <p className="text-xl font-bold">{matiereDetails.length}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Meilleure matière</p>
                      <p className="text-xl font-bold text-primary">{matiereDetails[0]?.nom || '—'}</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* ── Notes & Bulletins ── */}
              <TabsContent value="notes" className="space-y-4 mt-4">
                {/* Averages by period */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Moyennes par période</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Période</TableHead>
                          <TableHead className="text-center">Moyenne</TableHead>
                          <TableHead className="text-center">Décision</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {periodeAverages.filter(p => p.moyenne !== null).length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Aucune note enregistrée</TableCell></TableRow>
                        ) : periodeAverages.map((p, i) => (
                          p.moyenne !== null && (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                {p.periode} {p.est_rattrapage && <Badge variant="outline" className="ml-2 text-xs">Rattrapage</Badge>}
                              </TableCell>
                              <TableCell className="text-center">
                                <span className={`font-bold ${p.moyenne >= 10 ? 'text-accent' : 'text-destructive'}`}>
                                  {p.moyenne.toFixed(2)}/20
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={p.moyenne >= 10 ? 'default' : 'destructive'}>
                                  {p.moyenne >= 15 ? '🏆 Honneur' : p.moyenne >= 10 ? '✅ Admis' : '⚠️ Rattrapage'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Detail per matière */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Détail par matière (toutes périodes)</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matière</TableHead>
                          <TableHead>Pôle</TableHead>
                          <TableHead className="text-center">Moyenne</TableHead>
                          <TableHead className="text-center">Coef</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matiereDetails.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Aucune donnée</TableCell></TableRow>
                        ) : matiereDetails.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.nom}</TableCell>
                            <TableCell><Badge variant="outline">{m.pole}</Badge></TableCell>
                            <TableCell className="text-center">
                              <span className={`font-bold ${m.moyenne >= 10 ? 'text-accent' : 'text-destructive'}`}>
                                {m.moyenne.toFixed(2)}/20
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{m.coef}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Profil Radar ── */}
              <TabsContent value="radar" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Profil d'orientation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="pole" tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 20]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                          <Radar name="Moyenne" dataKey="moyenne" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              color: 'hsl(var(--popover-foreground))',
                            }}
                            formatter={(value: number) => [`${value.toFixed(2)}/20`, 'Moyenne']}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>Aucune note avec pôle défini</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
