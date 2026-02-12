import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Award, Printer, User, Trophy, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Bulletins() {
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [selectedEleve, setSelectedEleve] = useState('');

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-bulletin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, cycle_id, frais_scolarite, cycles:cycle_id(nom))').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: periodes = [] } = useQuery({
    queryKey: ['periodes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periodes').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves-classe', classeId],
    queryFn: async () => {
      if (!classeId) return [];
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, date_naissance, sexe').eq('classe_id', classeId).order('nom');
      if (error) throw error;
      return data;
    },
    enabled: !!classeId,
  });

  const selectedCl = classes.find((c: any) => c.id === classeId);
  const cycleId = selectedCl?.niveaux?.cycle_id || '';

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres-bulletin', cycleId],
    queryFn: async () => {
      if (!cycleId) return [];
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('pole').order('nom');
      if (error) throw error;
      return data;
    },
    enabled: !!cycleId,
  });

  // All notes for the entire class for this period (for ranking)
  const { data: allClassNotes = [] } = useQuery({
    queryKey: ['notes-classe', classeId, periodeId],
    queryFn: async () => {
      if (!classeId || !periodeId) return [];
      const eleveIds = eleves.map((e: any) => e.id);
      if (eleveIds.length === 0) return [];
      const { data, error } = await supabase
        .from('notes')
        .select('*, matieres(nom, coefficient, pole)')
        .in('eleve_id', eleveIds)
        .eq('periode_id', periodeId);
      if (error) throw error;
      return data;
    },
    enabled: !!classeId && !!periodeId && eleves.length > 0,
  });

  // Selected student's notes for this period
  const studentNotes = useMemo(() => {
    return allClassNotes.filter((n: any) => n.eleve_id === selectedEleve);
  }, [allClassNotes, selectedEleve]);

  // All period notes for annual average
  const { data: allAnnualNotes = [] } = useQuery({
    queryKey: ['notes-annuelles-classe', classeId],
    queryFn: async () => {
      if (!classeId) return [];
      const eleveIds = eleves.map((e: any) => e.id);
      const regularPeriodes = periodes.filter((p: any) => !p.est_rattrapage).map((p: any) => p.id);
      if (eleveIds.length === 0 || regularPeriodes.length === 0) return [];
      const { data, error } = await supabase
        .from('notes')
        .select('*, matieres(nom, coefficient, pole)')
        .in('eleve_id', eleveIds)
        .in('periode_id', regularPeriodes);
      if (error) throw error;
      return data;
    },
    enabled: !!classeId && eleves.length > 0 && periodes.length > 0,
  });

  const isPrimaire = selectedCl?.niveaux?.cycles?.nom?.includes('Primaire') || selectedCl?.niveaux?.cycles?.nom?.includes('Crèche') || selectedCl?.niveaux?.cycles?.nom?.includes('Maternelle');
  const seuil = isPrimaire ? 6 : 12;
  const bareme = isPrimaire ? 10 : 20;

  // Compute average for a given student and notes set
  const computeAverage = (eleveId: string, notesSet: any[]) => {
    const studentN = notesSet.filter((n: any) => n.eleve_id === eleveId && n.note !== null);
    if (studentN.length === 0) return null;
    let totalW = 0, totalC = 0;
    studentN.forEach((n: any) => {
      const coef = Number(n.matieres?.coefficient) || 1;
      totalW += Number(n.note) * coef;
      totalC += coef;
    });
    return totalC > 0 ? totalW / totalC : null;
  };

  // Rankings for current period
  const rankings = useMemo(() => {
    const avgs = eleves.map((e: any) => ({
      id: e.id,
      nom: `${e.prenom} ${e.nom}`,
      moyenne: computeAverage(e.id, allClassNotes),
    }));
    avgs.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
    let rank = 0, lastAvg: number | null = null;
    return avgs.map((a, i) => {
      if (a.moyenne !== lastAvg) { rank = i + 1; lastAvg = a.moyenne; }
      return { ...a, rang: a.moyenne !== null ? rank : null };
    });
  }, [eleves, allClassNotes]);

  const currentRanking = rankings.find(r => r.id === selectedEleve);
  const totalClasseEleves = eleves.length;

  // Class averages per matiere (min, max, class avg)
  const classMatiereStats = useMemo(() => {
    const stats: Record<string, { notes: number[] }> = {};
    allClassNotes.forEach((n: any) => {
      if (n.note !== null) {
        if (!stats[n.matiere_id]) stats[n.matiere_id] = { notes: [] };
        stats[n.matiere_id].notes.push(Number(n.note));
      }
    });
    return Object.fromEntries(
      Object.entries(stats).map(([id, s]) => [id, {
        min: Math.min(...s.notes),
        max: Math.max(...s.notes),
        avg: s.notes.reduce((a, b) => a + b, 0) / s.notes.length,
      }])
    );
  }, [allClassNotes]);

  // Bulletin data for selected student
  const bulletinData = useMemo(() => {
    return matieres.map((m: any) => {
      const n = studentNotes.find((note: any) => note.matiere_id === m.id);
      const noteVal = n?.note != null ? Number(n.note) : null;
      const coef = Number(m.coefficient) || 1;
      const stats = classMatiereStats[m.id];
      return {
        matiere: m.nom,
        pole: m.pole,
        note: noteVal,
        coefficient: coef,
        total: noteVal !== null ? noteVal * coef : null,
        classeMin: stats?.min ?? null,
        classeMax: stats?.max ?? null,
        classeAvg: stats?.avg ?? null,
      };
    });
  }, [matieres, studentNotes, classMatiereStats]);

  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);
  const totalPoints = bulletinData.reduce((s, b) => s + (b.total || 0), 0);
  const moyennePeriode = totalCoef > 0 && bulletinData.some(b => b.note !== null) ? (totalPoints / totalCoef) : null;

  // Annual average
  const moyenneAnnuelle = useMemo(() => {
    return computeAverage(selectedEleve, allAnnualNotes);
  }, [selectedEleve, allAnnualNotes]);

  // Annual ranking
  const annualRankings = useMemo(() => {
    const avgs = eleves.map((e: any) => ({
      id: e.id,
      moyenne: computeAverage(e.id, allAnnualNotes),
    }));
    avgs.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
    let rank = 0, lastAvg: number | null = null;
    return avgs.map((a, i) => {
      if (a.moyenne !== lastAvg) { rank = i + 1; lastAvg = a.moyenne; }
      return { ...a, rang: a.moyenne !== null ? rank : null };
    });
  }, [eleves, allAnnualNotes]);
  const annualRank = annualRankings.find(r => r.id === selectedEleve);

  // Major of class
  const major = rankings.length > 0 && rankings[0].moyenne !== null ? rankings[0] : null;

  const eleve = eleves.find((e: any) => e.id === selectedEleve);
  const periode = periodes.find((p: any) => p.id === periodeId);

  const getAppreciation = (note: number | null) => {
    if (note === null) return null;
    const ratio = note / bareme;
    if (ratio >= 0.85) return { text: 'Excellent', variant: 'default' as const };
    if (ratio >= 0.70) return { text: 'Très Bien', variant: 'default' as const };
    if (ratio >= 0.60) return { text: 'Bien', variant: 'default' as const };
    if (ratio >= 0.50) return { text: 'Assez Bien', variant: 'secondary' as const };
    if (ratio >= 0.40) return { text: 'Passable', variant: 'secondary' as const };
    return { text: 'Insuffisant', variant: 'destructive' as const };
  };

  const handlePrint = () => window.print();

  // Group by pole
  const poleGroups = useMemo(() => {
    const groups: Record<string, typeof bulletinData> = {};
    bulletinData.forEach(b => {
      const p = b.pole || 'Autres';
      if (!groups[p]) groups[p] = [];
      groups[p].push(b);
    });
    return groups;
  }, [bulletinData]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Award className="h-7 w-7 text-primary" /> Bulletins Scolaires
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Classe</Label>
              <Select value={classeId} onValueChange={(v) => { setClasseId(v); setSelectedEleve(''); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner la classe" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Période</Label>
              <Select value={periodeId} onValueChange={setPeriodeId}>
                <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
                <SelectContent>
                  {periodes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nom} {p.est_rattrapage ? '(Rattrapage)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Élève</Label>
              <Select value={selectedEleve} onValueChange={setSelectedEleve}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'élève" /></SelectTrigger>
                <SelectContent>
                  {eleves.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Aucun élève</SelectItem>
                  ) : eleves.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulletin */}
      {selectedEleve && periodeId ? (
        <div id="bulletin-print">
          {/* Header card */}
          <Card className="print:shadow-none print:border-2 print:border-foreground">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Bulletin Scolaire</p>
                  <CardTitle className="text-xl mt-1">
                    {eleve?.prenom} {eleve?.nom}
                  </CardTitle>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>Matricule : {eleve?.matricule || '—'}</span>
                    <span>Sexe : {eleve?.sexe || '—'}</span>
                    {eleve?.date_naissance && <span>Né(e) le : {new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{selectedCl?.niveaux?.cycles?.nom} — {selectedCl?.niveaux?.nom}</p>
                  <p className="text-sm text-muted-foreground">Classe : {selectedCl?.nom}</p>
                  <p className="text-sm text-muted-foreground">{periode?.nom} — {periode?.annee_scolaire}</p>
                  <p className="text-sm">Effectif : {totalClasseEleves} élèves</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Matière</TableHead>
                    <TableHead className="text-center w-20">Note /{bareme}</TableHead>
                    <TableHead className="text-center w-16">Coef</TableHead>
                    <TableHead className="text-center w-20">Total</TableHead>
                    <TableHead className="text-center w-16">Min</TableHead>
                    <TableHead className="text-center w-16">Max</TableHead>
                    <TableHead className="text-center w-16">Moy. Cl.</TableHead>
                    <TableHead className="text-center w-28">Appréciation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(poleGroups).map(([pole, items]) => (
                    <>
                      <TableRow key={`pole-${pole}`} className="bg-primary/5">
                        <TableCell colSpan={8} className="font-bold text-primary text-xs uppercase tracking-wider py-1.5">
                          {pole}
                        </TableCell>
                      </TableRow>
                      {items.map((b, i) => {
                        const appreciation = getAppreciation(b.note);
                        return (
                          <TableRow key={`${pole}-${i}`}>
                            <TableCell className="font-medium">{b.matiere}</TableCell>
                            <TableCell className="text-center font-mono">
                              {b.note !== null ? b.note.toFixed(2) : '—'}
                            </TableCell>
                            <TableCell className="text-center">{b.coefficient}</TableCell>
                            <TableCell className="text-center font-mono font-bold">
                              {b.total !== null ? b.total.toFixed(2) : '—'}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {b.classeMin !== null ? b.classeMin.toFixed(1) : '—'}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {b.classeMax !== null ? b.classeMax.toFixed(1) : '—'}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {b.classeAvg !== null ? b.classeAvg.toFixed(1) : '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              {appreciation ? (
                                <Badge variant={appreciation.variant} className="text-xs">{appreciation.text}</Badge>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <Card className="border-primary/40">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Moyenne période</p>
                <p className={`text-2xl font-bold ${moyennePeriode !== null && moyennePeriode >= seuil ? 'text-accent' : 'text-destructive'}`}>
                  {moyennePeriode !== null ? `${moyennePeriode.toFixed(2)}/${bareme}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Rang</p>
                <p className="text-2xl font-bold flex items-center justify-center gap-1">
                  {currentRanking?.rang !== null ? (
                    <>
                      {currentRanking?.rang === 1 && <Trophy className="h-5 w-5 text-secondary" />}
                      {currentRanking?.rang}<sup>e</sup> / {totalClasseEleves}
                    </>
                  ) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Moy. annuelle</p>
                <p className={`text-2xl font-bold ${moyenneAnnuelle !== null && moyenneAnnuelle >= seuil ? 'text-accent' : 'text-destructive'}`}>
                  {moyenneAnnuelle !== null ? `${moyenneAnnuelle.toFixed(2)}/${bareme}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground">Décision</p>
                {moyennePeriode !== null ? (
                  <Badge variant={moyennePeriode >= seuil ? 'default' : 'destructive'} className="text-sm mt-1">
                    {moyennePeriode >= seuil * 1.5 ? '🏆 Tableau d\'honneur' : moyennePeriode >= seuil ? '✅ Admis(e)' : '⚠️ Rattrapage'}
                  </Badge>
                ) : <span className="text-muted-foreground">—</span>}
              </CardContent>
            </Card>
          </div>

          {/* Major info */}
          {major && (
            <Card className="mt-4 border-secondary/30 bg-secondary/5">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Trophy className="h-6 w-6 text-secondary" />
                <div>
                  <p className="text-sm font-medium">Major de la classe : <strong>{major.nom}</strong></p>
                  <p className="text-xs text-muted-foreground">Moyenne : {major.moyenne?.toFixed(2)}/{bareme}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Print button */}
          <div className="flex gap-3 mt-4 print:hidden">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" /> Imprimer le bulletin
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Sélectionnez une classe, une période et un élève pour générer le bulletin.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
