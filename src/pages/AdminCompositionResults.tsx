import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, Users, Trophy, Award, Printer, Download, Loader2, FileCheck2, ChevronRight } from 'lucide-react';

export default function AdminCompositionResults() {
  const { roles } = useAuth();
  const isCoordPrimaire = roles.includes('coordinateur');
  const isCoordSecondaire = roles.includes('coordinateur_secondaire');
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [filterClasse, setFilterClasse] = useState('all');

  // Fetch compositions
  const { data: rawCompositions = [], isLoading: loadingComps } = useQuery({
    queryKey: ['admin-compositions-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compositions')
        .select('id, titre, bareme, classe_id, matiere_id, date_debut, date_fin, type_composition, classes:classe_id(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom))), matieres:matiere_id(nom)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Filter by coordinator scope
  const compositions = useMemo(() => {
    if (isCoordPrimaire) {
      const allowed = ['Crèche', 'Maternelle', 'Primaire'];
      return rawCompositions.filter((c: any) => allowed.includes(c.classes?.niveaux?.cycles?.nom));
    }
    if (isCoordSecondaire) {
      const allowed = ['Collège', 'Lycée'];
      return rawCompositions.filter((c: any) => allowed.includes(c.classes?.niveaux?.cycles?.nom));
    }
    return rawCompositions;
  }, [rawCompositions, isCoordPrimaire, isCoordSecondaire]);

  // Fetch classes for filter
  const { data: allClasses = [] } = useQuery({
    queryKey: ['admin-comps-classes'],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, nom, niveaux:niveau_id(cycles:cycle_id(nom))').order('nom');
      return data || [];
    },
  });

  const classes = useMemo(() => {
    if (isCoordPrimaire) {
      return allClasses.filter((c: any) => ['Crèche', 'Maternelle', 'Primaire'].includes(c.niveaux?.cycles?.nom));
    }
    if (isCoordSecondaire) {
      return allClasses.filter((c: any) => ['Collège', 'Lycée'].includes(c.niveaux?.cycles?.nom));
    }
    return allClasses;
  }, [allClasses, isCoordPrimaire, isCoordSecondaire]);

  // Filter compositions
  const filteredComps = useMemo(() => {
    if (filterClasse === 'all') return compositions;
    return compositions.filter((c: any) => c.classe_id === filterClasse);
  }, [compositions, filterClasse]);

  // Group compositions by title (same comp across multiple classes)
  const groupedComps = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredComps.forEach((c: any) => {
      const key = c.titre;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries());
  }, [filteredComps]);

  // Fetch results for selected composition(s)
  const selectedTitle = selectedCompId ? compositions.find((c: any) => c.id === selectedCompId)?.titre : null;
  const selectedCompIds = selectedTitle
    ? compositions.filter((c: any) => c.titre === selectedTitle).map((c: any) => c.id)
    : [];

  const { data: results = [], isLoading: loadingResults } = useQuery({
    queryKey: ['admin-comp-results', selectedCompIds],
    queryFn: async () => {
      if (selectedCompIds.length === 0) return [];
      const { data, error } = await supabase
        .from('composition_reponses')
        .select('id, composition_id, eleve_id, score, soumis_at, reponses, compositions:composition_id(titre, bareme, classe_id, classes:classe_id(nom, niveaux:niveau_id(nom))), eleves:eleve_id(id, nom, prenom, matricule, classe_id, classes:classe_id(nom, niveaux:niveau_id(nom)))')
        .in('composition_id', selectedCompIds)
        .order('score', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: selectedCompIds.length > 0,
  });

  // Fetch effectif for the classes
  const { data: effectif = [] } = useQuery({
    queryKey: ['admin-comp-effectif', selectedCompIds],
    queryFn: async () => {
      const classeIds = [...new Set(compositions.filter((c: any) => selectedCompIds.includes(c.id)).map((c: any) => c.classe_id))];
      if (classeIds.length === 0) return [];
      const { data } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes:classe_id(nom)')
        .in('classe_id', classeIds)
        .eq('statut', 'inscrit')
        .is('deleted_at', null);
      return data || [];
    },
    enabled: selectedCompIds.length > 0,
  });

  // Group results by class
  const resultsByClass = useMemo(() => {
    const map = new Map<string, any[]>();
    results.forEach((r: any) => {
      const className = r.eleves?.classes?.nom || 'Sans classe';
      if (!map.has(className)) map.set(className, []);
      map.get(className)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  const selectedComp = selectedCompId ? compositions.find((c: any) => c.id === selectedCompId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" /> Résultats des Compositions
        </h1>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrer par classe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingComps ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : groupedComps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileCheck2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucune composition trouvée</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {groupedComps.map(([titre, comps]) => {
            const firstComp = comps[0];
            const classNames = comps.map((c: any) => c.classes?.nom).filter(Boolean).join(', ');
            const typeLabel = firstComp.type_composition === 'qcm' ? 'QCM' :
              firstComp.type_composition === 'qcm_multiple' ? 'QCM Multiple' :
              firstComp.type_composition === 'document' ? 'Document' :
              firstComp.type_composition === 'texte' ? 'Texte' :
              firstComp.type_composition === 'primaire_interactif' ? '🎨 Primaire' :
              firstComp.type_composition === 'geometrie_traces' ? '📐 Géométrie' :
              firstComp.type_composition;

            return (
              <Card
                key={titre}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedCompId(firstComp.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{titre}</p>
                        <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>📚 {firstComp.matieres?.nom || '—'}</span>
                        <span>🏫 {classNames || '—'}</span>
                        <span>📊 Barème: {firstComp.bareme}</span>
                        <span>📅 {new Date(firstComp.date_debut).toLocaleDateString('fr')}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Results Dialog */}
      <Dialog open={!!selectedCompId} onOpenChange={() => setSelectedCompId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                {selectedComp?.titre || 'Résultats'}
              </DialogTitle>
              {resultsByClass.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1" /> Imprimer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    import('@/lib/excelUtils').then(({ exportToExcel }) => {
                      const rows: any[] = [];
                      resultsByClass.forEach(([className, students]) => {
                        const classeEleves = effectif.filter((e: any) => (e.classes?.nom || '') === className);
                        const composedIds = new Set(students.map((s: any) => s.eleve_id));
                        const nonComposed = classeEleves.filter((e: any) => !composedIds.has(e.id));
                        students.sort((a: any, b: any) => (b.score ?? -1) - (a.score ?? -1)).forEach((r: any, i: number) => {
                          rows.push({
                            Classe: className, '#': i + 1,
                            Prénom: r.eleves?.prenom, Nom: r.eleves?.nom,
                            Matricule: r.eleves?.matricule,
                            Note: r.score != null ? `${r.score}/${selectedComp?.bareme}` : 'À noter',
                            Statut: 'Composé',
                            'Soumis le': r.soumis_at ? new Date(r.soumis_at).toLocaleString('fr') : '',
                          });
                        });
                        nonComposed.forEach((e: any) => {
                          rows.push({
                            Classe: className, '#': '',
                            Prénom: e.prenom, Nom: e.nom,
                            Matricule: e.matricule, Note: '', Statut: 'Non composé', 'Soumis le': '',
                          });
                        });
                      });
                      exportToExcel(rows, `Résultats_${selectedComp?.titre || 'composition'}`);
                    });
                  }}>
                    <Download className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {loadingResults ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : resultsByClass.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucun élève n'a encore passé cette composition</p>
          ) : (
            <div className="space-y-6">
              {/* Best per niveau */}
              {(() => {
                const niveauMap = new Map<string, { student: any; score: number; className: string }>();
                resultsByClass.forEach(([className, students]) => {
                  students.forEach((s: any) => {
                    const niveau = s.eleves?.classes?.niveaux?.nom || '';
                    if (niveau && s.score != null) {
                      const existing = niveauMap.get(niveau);
                      if (!existing || s.score > existing.score) {
                        niveauMap.set(niveau, { student: s, score: s.score, className });
                      }
                    }
                  });
                });
                if (niveauMap.size > 0) {
                  return (
                    <Card className="border-2 border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" /> Meilleure note par niveau
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Array.from(niveauMap.entries()).map(([niveau, { student, score, className }]) => (
                            <div key={niveau} className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <Trophy className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-muted-foreground">{niveau}</p>
                                <p className="font-semibold text-sm truncate">{student.eleves?.prenom} {student.eleves?.nom}</p>
                                <p className="text-xs text-muted-foreground">{className} — <strong className="text-primary">{score}/{selectedComp?.bareme}</strong></p>
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

              {/* Results per class */}
              {resultsByClass.map(([className, students]) => {
                const scored = students.filter((s: any) => s.score != null);
                const avg = scored.length > 0 ? (scored.reduce((sum: number, s: any) => sum + s.score, 0) / scored.length).toFixed(1) : '—';
                const max = scored.length > 0 ? Math.max(...scored.map((s: any) => s.score)) : '—';
                const min = scored.length > 0 ? Math.min(...scored.map((s: any) => s.score)) : '—';
                const bareme = selectedComp?.bareme || 20;
                const bestStudent = scored.length > 0 ? scored.reduce((best: any, s: any) => (s.score > (best?.score ?? -1) ? s : best), null) : null;

                const classeEleves = effectif.filter((e: any) => (e.classes?.nom || '') === className);
                const composedIds = new Set(students.map((s: any) => s.eleve_id));
                const nonComposed = classeEleves.filter((e: any) => !composedIds.has(e.id));
                const totalEffectif = classeEleves.length || students.length;

                return (
                  <Card key={className} className="border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" /> {className}
                        </CardTitle>
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <Badge variant="default" className="text-xs">{students.length}/{totalEffectif} composé{students.length > 1 ? 's' : ''}</Badge>
                          {nonComposed.length > 0 && <Badge variant="destructive" className="text-xs">{nonComposed.length} absent{nonComposed.length > 1 ? 's' : ''}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm mt-1 flex-wrap">
                        <span className="text-muted-foreground">Moy: <strong className="text-foreground">{avg}/{bareme}</strong></span>
                        <span className="text-muted-foreground">Max: <strong className="text-primary">{max}</strong></span>
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
