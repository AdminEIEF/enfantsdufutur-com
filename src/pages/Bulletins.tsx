import { useState, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Award, Printer, User, Trophy, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import BulletinScolaire from '@/components/BulletinScolaire';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { generateBulletinPDF } from '@/lib/generateBulletinPDF';
import { sortClasses } from '@/lib/utils';
import { toast } from 'sonner';

export default function Bulletins() {
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [selectedEleve, setSelectedEleve] = useState('');
  const [showPrintView, setShowPrintView] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { data: schoolConfig } = useSchoolConfig();

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-bulletin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, ordre, cycle_id, frais_scolarite, cycles:cycle_id(nom, ordre, bareme))');
      if (error) throw error;
      return sortClasses(data || []);
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
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('ordre');
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

  // All period notes for annual average (paginated to avoid 1000-row limit)
  const { data: allAnnualNotes = [] } = useQuery({
    queryKey: ['notes-annuelles-classe', classeId, periodeId],
    queryFn: async () => {
      if (!classeId) return [];
      const eleveIds = eleves.map((e: any) => e.id);
      const otherPeriodes = periodes.filter((p: any) => !p.est_rattrapage && p.id !== periodeId).map((p: any) => p.id);
      if (eleveIds.length === 0 || otherPeriodes.length === 0) return [];
      // Fetch per period to avoid 1000-row limit (skip current period, we use allClassNotes for it)
      const allNotes: any[] = [];
      for (const pId of otherPeriodes) {
        const { data, error } = await supabase
          .from('notes')
          .select('*, matieres(nom, coefficient, pole)')
          .in('eleve_id', eleveIds)
          .eq('periode_id', pId);
        if (error) throw error;
        if (data) allNotes.push(...data);
      }
      return allNotes;
    },
    enabled: !!classeId && !!periodeId && eleves.length > 0 && periodes.length > 0,
  });

  // Merged notes: allAnnualNotes (other periods) + allClassNotes (current period) = complete year data
  const mergedAllNotes = useMemo(() => {
    return [...allAnnualNotes, ...allClassNotes];
  }, [allAnnualNotes, allClassNotes]);

  const bareme = selectedCl?.niveaux?.cycles?.bareme ?? 20;
  const seuil = bareme / 2;

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

  const regularPeriodes = useMemo(
    () => periodes.filter((p: any) => !p.est_rattrapage),
    [periodes]
  );

  // Get notes for a specific period: current period from allClassNotes (fresh), others from allAnnualNotes
  const getNotesForPeriod = (targetPeriodeId: string) => (
    targetPeriodeId === periodeId
      ? allClassNotes
      : allAnnualNotes.filter((n: any) => n.periode_id === targetPeriodeId)
  );

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

  const periode = periodes.find((p: any) => p.id === periodeId);
  const isP5 = periode?.nom === 'P5';

  // Bulletin data for selected student
  const bulletinData = useMemo(() => {
    const regularPeriodes = periodes.filter((p: any) => !p.est_rattrapage);
    return matieres.map((m: any) => {
      const n = studentNotes.find((note: any) => note.matiere_id === m.id);
      const noteVal = n?.note != null ? Number(n.note) : null;
      const coef = Number(m.coefficient) || 1;
      const stats = classMatiereStats[m.id];

      // In P5, compute annual average per matière (sum of period notes / nb periods with notes)
      let displayNote = noteVal;
      if (isP5) {
        const periodNotes: number[] = [];
        regularPeriodes.forEach((p: any) => {
          const pNotes = getNotesForPeriod(p.id).filter((an: any) => an.eleve_id === selectedEleve && an.matiere_id === m.id);
          const found = pNotes.length > 0 ? pNotes[0] : null;
          if (found?.note != null) periodNotes.push(Number(found.note));
        });
        displayNote = periodNotes.length > 0 ? periodNotes.reduce((a, b) => a + b, 0) / periodNotes.length : null;
      }

      return {
        matiere: m.nom,
        pole: m.pole,
        note: displayNote,
        coefficient: coef,
        total: displayNote !== null ? displayNote * coef : null,
        classeMin: stats?.min ?? null,
        classeMax: stats?.max ?? null,
        classeAvg: stats?.avg ?? null,
      };
    });
  }, [matieres, studentNotes, classMatiereStats, isP5, mergedAllNotes, periodes, selectedEleve]);

  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);
  const totalPoints = bulletinData.reduce((s, b) => s + (b.total || 0), 0);
  const moyennePeriodeReelle = useMemo(() => {
    if (!selectedEleve) return null;
    return computeAverage(selectedEleve, allClassNotes);
  }, [selectedEleve, allClassNotes]);
  const moyennePeriode = totalCoef > 0 && bulletinData.some(b => b.note !== null) ? (totalPoints / totalCoef) : null;


  // Annual ranking based on moyenneAnnuelleSimple (average of period averages)
  const annualRankings = useMemo(() => {
    const avgs = eleves.map((e: any) => {
      const periodAverages: number[] = [];
      regularPeriodes.forEach((p: any) => {
        const pNotes = getNotesForPeriod(p.id).filter((n: any) => n.eleve_id === e.id);
        const avg = computeAverage(e.id, pNotes);
        if (avg !== null) periodAverages.push(avg);
      });
      const moyenne = periodAverages.length > 0
        ? periodAverages.reduce((a, b) => a + b, 0) / periodAverages.length
        : null;
      return { id: e.id, moyenne };
    });
    avgs.sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
    let rank = 0, lastAvg: number | null = null;
    return avgs.map((a, i) => {
      if (a.moyenne !== lastAvg) { rank = i + 1; lastAvg = a.moyenne; }
      return { ...a, rang: a.moyenne !== null ? rank : null };
    });
  }, [eleves, allAnnualNotes, allClassNotes, periodeId, regularPeriodes]);
  const annualRank = annualRankings.find(r => r.id === selectedEleve);

  // Major of class
  const major = rankings.length > 0 && rankings[0].moyenne !== null ? rankings[0] : null;

  const eleve = eleves.find((e: any) => e.id === selectedEleve);
  // periode already declared above

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
        <>
          {/* Toggle between card view and print view */}
          <div className="flex gap-3 print:hidden">
            <Button
              variant={!showPrintView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPrintView(false)}
            >
              Vue détaillée
            </Button>
            <Button
              variant={showPrintView ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPrintView(true)}
            >
              <Printer className="h-4 w-4 mr-2" /> Vue impression A4
            </Button>
          </div>

          {showPrintView ? (
            <div id="bulletin-print">
              <div className="no-print flex gap-3 mb-4">
                <Button onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimer le bulletin
                </Button>
                <Button
                  variant="outline"
                  disabled={pdfLoading}
                  onClick={async () => {
                    setPdfLoading(true);
                    try {
                      const filename = `bulletin_${eleve?.prenom}_${eleve?.nom}_${periode?.nom || ''}.pdf`.replace(/\s+/g, '_');
                      await generateBulletinPDF('bulletin-print', filename);
                      toast.success('PDF téléchargé avec succès');
                    } catch (e: any) {
                      toast.error(e.message || 'Erreur lors de la génération du PDF');
                    } finally {
                      setPdfLoading(false);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
                </Button>
              </div>
              <BulletinScolaire
                eleve={{
                  nom: eleve?.nom || '',
                  prenom: eleve?.prenom || '',
                  matricule: eleve?.matricule || null,
                  sexe: eleve?.sexe || null,
                  date_naissance: eleve?.date_naissance || null,
                }}
                classe={`${selectedCl?.niveaux?.nom || ''} — ${selectedCl?.nom || ''}`}
                effectif={totalClasseEleves}
                periodeName={periode?.nom || ''}
                bulletinData={bulletinData.map(b => ({
                  matiere: b.matiere,
                  pole: b.pole,
                  coefficient: b.coefficient,
                  note: b.note,
                  rang: null,
                  appreciation: b.note !== null ? getAppreciation(b.note)?.text || null : null,
                }))}
                moyennePeriode={moyennePeriode}
                rang={currentRanking?.rang ?? null}
                plusForte={rankings.length > 0 && rankings[0].moyenne !== null ? rankings[0].moyenne : null}
                plusFaible={rankings.length > 0 && rankings[rankings.length - 1].moyenne !== null ? rankings[rankings.length - 1].moyenne : null}
                bareme={bareme}
                seuil={seuil}
                previousPeriods={(() => {
                  const currentOrdre = periode?.ordre ?? 0;
                  return regularPeriodes
                   .filter((p: any) => p.ordre <= currentOrdre)
                    .sort((a: any, b: any) => a.ordre - b.ordre)
                    .map((p: any) => {
                      const pNotes = getNotesForPeriod(p.id);
                      const pAvg = computeAverage(selectedEleve, pNotes);
                      // Compute rank for this period
                      const pAvgs = eleves.map((e: any) => ({
                        id: e.id,
                        moyenne: computeAverage(e.id, pNotes),
                      }));
                      pAvgs.sort((a: any, b: any) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
                      let pRank = 0, pLast: number | null = null;
                      const pRanked = pAvgs.map((a: any, i: number) => {
                        if (a.moyenne !== pLast) { pRank = i + 1; pLast = a.moyenne; }
                        return { ...a, rang: a.moyenne !== null ? pRank : null };
                      });
                      const studentRank = pRanked.find((r: any) => r.id === selectedEleve);
                      const ratio = pAvg !== null ? pAvg / bareme : null;
                      let mention: string | null = null;
                      if (ratio !== null) {
                        if (ratio >= 0.85) mention = 'Excellent';
                        else if (ratio >= 0.70) mention = 'Très Bien';
                        else if (ratio >= 0.60) mention = 'Bien';
                        else if (ratio >= 0.50) mention = 'Assez Bien';
                        else if (ratio >= 0.40) mention = 'Passable';
                        else mention = 'Insuffisant';
                      }
                      return {
                        periodeName: p.nom,
                        moyenne: pAvg,
                        rang: studentRank?.rang ?? null,
                        effectif: eleves.length,
                        mention,
                      };
                    });
                })()}
                cycleName={selectedCl?.niveaux?.cycles?.nom}
                anneeScolaire={periode?.annee_scolaire}
                schoolName={schoolConfig?.nom}
                schoolSubtitle={schoolConfig?.soustitre}
                schoolCity={schoolConfig?.ville}
                schoolLogoUrl={schoolConfig?.logo_url}
                isFinalPeriod={periode?.nom === 'P5'}
                previousPeriodsNotes={(() => {
                  const currentOrdre = periode?.ordre ?? 0;
                  return regularPeriodes
                   .filter((p: any) => p.ordre <= currentOrdre)
                    .sort((a: any, b: any) => a.ordre - b.ordre)
                    .map((p: any) => {
                      const pNotes = getNotesForPeriod(p.id).filter((n: any) => n.eleve_id === selectedEleve);
                      const notesByMatiere: Record<string, number | null> = {};
                      matieres.forEach((m: any) => {
                        const found = pNotes.find((n: any) => n.matiere_id === m.id);
                        notesByMatiere[m.nom] = found?.note != null ? Number(found.note) : null;
                      });
                      return { periodeName: p.nom, notesByMatiere };
                    });
                })()}
                moyenneAnnuelle={isP5 ? moyenneAnnuelleSimple : null}
                moyenneClasse={isP5 ? moyenneClasse : null}
                rangAnnuel={isP5 ? (annualRank?.rang ?? null) : null}
              />
            </div>
          ) : (
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
                        <TableHead className="text-center w-20">Moyenne</TableHead>
                        <TableHead className="text-center w-16">Coef</TableHead>
                        <TableHead className="text-center w-20">Moyenne Coeff</TableHead>
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
              <div className={`grid grid-cols-2 md:grid-cols-3 ${isP5 ? 'lg:grid-cols-6' : 'lg:grid-cols-3'} gap-4 mt-4`}>
                <Card className="border-primary/40">
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground">Moyenne {periode?.nom}</p>
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
                {isP5 && (
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Moy. annuelle</p>
                      <p className={`text-2xl font-bold ${moyenneAnnuelleSimple !== null && moyenneAnnuelleSimple >= seuil ? 'text-accent' : 'text-destructive'}`}>
                        {moyenneAnnuelleSimple !== null ? `${moyenneAnnuelleSimple.toFixed(2)}/${bareme}` : '—'}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {isP5 && (
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Moy. de la classe</p>
                      <p className={`text-2xl font-bold ${moyenneClasse !== null && moyenneClasse >= seuil ? 'text-accent' : 'text-destructive'}`}>
                        {moyenneClasse !== null ? `${moyenneClasse.toFixed(2)}/${bareme}` : '—'}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {isP5 && (
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Rang annuel</p>
                      <p className="text-2xl font-bold flex items-center justify-center gap-1">
                        {annualRank?.rang !== null ? (
                          <>
                            {annualRank?.rang}<sup>e</sup> / {totalClasseEleves}
                          </>
                        ) : '—'}
                      </p>
                    </CardContent>
                  </Card>
                )}
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

              {/* Récapitulatif des évaluations précédentes */}
              {(() => {
                const currentOrdre = periode?.ordre ?? 0;
                const prevPeriods = regularPeriodes
                  .filter((p: any) => p.ordre <= currentOrdre)
                  .sort((a: any, b: any) => a.ordre - b.ordre)
                  .map((p: any) => {
                    const pNotes = getNotesForPeriod(p.id);
                    const pAvg = computeAverage(selectedEleve, pNotes);
                    const pAvgs = eleves.map((e: any) => ({
                      id: e.id,
                      moyenne: computeAverage(e.id, pNotes),
                    }));
                    pAvgs.sort((a: any, b: any) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
                    let pRank = 0, pLast: number | null = null;
                    const pRanked = pAvgs.map((a: any, i: number) => {
                      if (a.moyenne !== pLast) { pRank = i + 1; pLast = a.moyenne; }
                      return { ...a, rang: a.moyenne !== null ? pRank : null };
                    });
                    const studentRank = pRanked.find((r: any) => r.id === selectedEleve);
                    const ratio = pAvg !== null ? pAvg / bareme : null;
                    let mention: string | null = null;
                    if (ratio !== null) {
                      if (ratio >= 0.85) mention = 'Excellent';
                      else if (ratio >= 0.70) mention = 'Très Bien';
                      else if (ratio >= 0.60) mention = 'Bien';
                      else if (ratio >= 0.50) mention = 'Assez Bien';
                      else if (ratio >= 0.40) mention = 'Passable';
                      else mention = 'Insuffisant';
                    }
                    return { periodeName: p.nom, moyenne: pAvg, rang: studentRank?.rang ?? null, effectif: eleves.length, mention };
                  });
                // Compute class average for each period
                const moyenneClasseParPeriode = regularPeriodes
                  .filter((p: any) => p.ordre <= currentOrdre)
                  .sort((a: any, b: any) => a.ordre - b.ordre)
                  .map((p: any) => {
                    const pNotes = getNotesForPeriod(p.id);
                    const avgs = eleves.map((e: any) => computeAverage(e.id, pNotes)).filter((a): a is number => a !== null);
                    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
                  });
                return prevPeriods.length > 0 ? (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Récapitulatif des évaluations</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Évaluation</TableHead>
                            <TableHead className="text-center">Moyenne</TableHead>
                            <TableHead className="text-center">Moy. Classe</TableHead>
                            <TableHead className="text-center">Rang</TableHead>
                            <TableHead className="text-center">Mention</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prevPeriods.map((pp, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{pp.periodeName}</TableCell>
                              <TableCell className={`text-center font-mono font-bold ${pp.moyenne !== null && pp.moyenne < seuil ? 'text-destructive' : ''}`}>
                                {pp.moyenne !== null ? `${pp.moyenne.toFixed(2)}/${bareme}` : '—'}
                              </TableCell>
                              <TableCell className="text-center font-mono text-muted-foreground">
                                {moyenneClasseParPeriode[idx] !== null ? `${moyenneClasseParPeriode[idx]!.toFixed(2)}/${bareme}` : '—'}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {pp.rang !== null ? `${pp.rang}e/${pp.effectif}` : '—'}
                              </TableCell>
                              <TableCell className="text-center italic">
                                {pp.mention || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Ligne Moyenne Annuelle */}
                          {isP5 && prevPeriods.length > 1 && (
                            <TableRow className="bg-primary/5 font-bold">
                              <TableCell className="font-bold">Moyenne Annuelle</TableCell>
                              <TableCell className={`text-center font-mono font-bold ${moyenneAnnuelleSimple !== null && moyenneAnnuelleSimple < seuil ? 'text-destructive' : 'text-accent'}`}>
                                {moyenneAnnuelleSimple !== null ? `${moyenneAnnuelleSimple.toFixed(2)}/${bareme}` : '—'}
                              </TableCell>
                              <TableCell className="text-center font-mono text-muted-foreground">
                                {moyenneClasse !== null ? `${moyenneClasse.toFixed(2)}/${bareme}` : '—'}
                              </TableCell>
                              <TableCell className="text-center font-mono">
                                {annualRank?.rang !== null ? `${annualRank?.rang}e/${totalClasseEleves}` : '—'}
                              </TableCell>
                              <TableCell className="text-center italic">
                                {moyenneAnnuelleSimple !== null ? (() => {
                                  const ratio = moyenneAnnuelleSimple / bareme;
                                  if (ratio >= 0.85) return 'Excellent';
                                  if (ratio >= 0.70) return 'Très Bien';
                                  if (ratio >= 0.60) return 'Bien';
                                  if (ratio >= 0.50) return 'Assez Bien';
                                  if (ratio >= 0.40) return 'Passable';
                                  return 'Insuffisant';
                                })() : '—'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {/* Graphique d'évolution des moyennes */}
              {(() => {
                const regularPeriodes = periodes.filter((p: any) => !p.est_rattrapage);
                const currentOrdre = periode?.ordre ?? 0;
                const chartData = regularPeriodes
                  .filter((p: any) => p.ordre <= currentOrdre)
                  .sort((a: any, b: any) => a.ordre - b.ordre)
                  .map((p: any) => {
                    const pNotes = getNotesForPeriod(p.id);
                    const avg = computeAverage(selectedEleve, pNotes);
                    return { periode: p.nom, moyenne: avg };
                  })
                  .filter(d => d.moyenne !== null);
                return chartData.length > 0 ? (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Évolution des moyennes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="periode" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, bareme]} tick={{ fontSize: 12 }} width={35} />
                            <Tooltip formatter={(value: number) => [`${value.toFixed(2)}/${bareme}`, 'Moyenne']} />
                            <ReferenceLine y={seuil} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: `Seuil (${seuil})`, fontSize: 10, fill: 'hsl(var(--destructive))' }} />
                            <Line type="monotone" dataKey="moyenne" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 5, fill: 'hsl(var(--primary))' }} activeDot={{ r: 7 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

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
          )}
        </>
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
