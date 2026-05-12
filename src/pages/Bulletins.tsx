import { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Printer, User, Trophy, FileText, Download, GraduationCap, School } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import BulletinScolaire from '@/components/BulletinScolaire';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { generateBulletinPDF } from '@/lib/generateBulletinPDF';
import { sortClasses } from '@/lib/utils';
import { toast } from 'sonner';

const SECONDAIRE_CYCLES = ['collège', 'lycée', 'college', 'lycee'];
const isSecondaireCycle = (cycleName: string) => SECONDAIRE_CYCLES.some(c => cycleName.toLowerCase().includes(c));

export default function Bulletins() {
  const { hasRole } = useAuth();
  const isCoordSecondaire = hasRole('coordinateur_secondaire' as any);
  const [sectionTab, setSectionTab] = useState<string>(isCoordSecondaire ? 'secondaire' : 'autres');
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
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, date_naissance, sexe, photo_url').eq('classe_id', classeId).order('nom');
      if (error) throw error;
      return data;
    },
    enabled: !!classeId,
  });

  const selectedCl = classes.find((c: any) => c.id === classeId);
  const cycleId = selectedCl?.niveaux?.cycle_id || '';

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres-bulletin', cycleId, classeId],
    queryFn: async () => {
      if (!cycleId || !classeId) return [];
      // Récupérer uniquement les matières COCHÉES pour cette classe
      const { data: cm, error: cmErr } = await supabase
        .from('classe_matieres')
        .select('matiere_id, coefficient, ordre')
        .eq('classe_id', classeId)
        .order('ordre');
      if (cmErr) throw cmErr;

      if (cm && cm.length > 0) {
        const ids = cm.map((x: any) => x.matiere_id);
        const { data: mats, error } = await supabase
          .from('matieres')
          .select('*')
          .in('id', ids);
        if (error) throw error;
        // Préserver l'ordre de classe_matieres + appliquer le coefficient configuré pour la classe
        return cm
          .map((x: any) => {
            const m = (mats || []).find((mm: any) => mm.id === x.matiere_id);
            return m ? { ...m, coefficient: Number(x.coefficient) || Number(m.coefficient) || 1, ordre: x.ordre } : null;
          })
          .filter(Boolean);
      }

      // Fallback : aucune config -> matières du cycle
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('ordre');
      if (error) throw error;
      return data;
    },
    enabled: !!cycleId && !!classeId,
  });

  // Set des matières autorisées (pour exclure des calculs toute note de matière non cochée)
  const allowedMatiereIds = useMemo(() => new Set(matieres.map((m: any) => m.id)), [matieres]);

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

  // Compute average for a given student and notes set (exclut les matières non cochées pour la classe)
  const computeAverage = (eleveId: string, notesSet: any[]) => {
    const studentN = notesSet.filter((n: any) => n.eleve_id === eleveId && n.note !== null && allowedMatiereIds.has(n.matiere_id));
    if (studentN.length === 0) return null;
    let totalW = 0, totalC = 0;
    // Utiliser le coefficient configuré dans classe_matieres (via matieres résolu)
    const coefMap = new Map(matieres.map((m: any) => [m.id, Number(m.coefficient) || 1]));
    studentN.forEach((n: any) => {
      const coef = coefMap.get(n.matiere_id) ?? (Number(n.matieres?.coefficient) || 1);
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

  // Eleves sorted by rank for display / PDF generation
  const sortedEleves = useMemo(() => {
    if (!classeId || !periodeId || rankings.length === 0) return eleves;
    const rankingMap = new Map(rankings.map(r => [r.id, r.rang]));
    return [...eleves].sort((a: any, b: any) => {
      const rankA = rankingMap.get(a.id);
      const rankB = rankingMap.get(b.id);
      if (rankA == null && rankB == null) return 0;
      if (rankA == null) return 1;
      if (rankB == null) return -1;
      return rankA - rankB;
    });
  }, [eleves, rankings, classeId, periodeId]);

  const currentRanking = rankings.find(r => r.id === selectedEleve);
  const totalClasseEleves = eleves.length;

  // Class averages per matiere (min, max, class avg) — uniquement matières cochées
  const classMatiereStats = useMemo(() => {
    const stats: Record<string, { notes: number[] }> = {};
    allClassNotes.forEach((n: any) => {
      if (n.note !== null && allowedMatiereIds.has(n.matiere_id)) {
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
  }, [allClassNotes, allowedMatiereIds]);

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
  const moyennePeriode = moyennePeriodeReelle;

  // Plus forte et plus faible moyenne de la classe (période courante)
  const plusForte = rankings.length > 0 && rankings[0].moyenne !== null ? rankings[0].moyenne : null;
  const plusFaible = rankings.length > 0 && rankings[rankings.length - 1].moyenne !== null ? rankings[rankings.length - 1].moyenne : null;

  // Moyenne de la classe (somme des moyennes / nombre d'élèves)
  const moyenneClasse = useMemo(() => {
    const avgs = eleves.map((e: any) => computeAverage(e.id, allClassNotes)).filter((a): a is number => a !== null);
    if (avgs.length === 0) return null;
    return avgs.reduce((a, b) => a + b, 0) / avgs.length;
  }, [eleves, allClassNotes]);

  // Moyenne annuelle simple: average of period averages
  const moyenneAnnuelle = useMemo(() => {
    const periodAverages: number[] = [];
    regularPeriodes.forEach((p: any) => {
      const pNotes = getNotesForPeriod(p.id);
      const avg = computeAverage(selectedEleve, pNotes);
      if (avg !== null) periodAverages.push(avg);
    });
    if (periodAverages.length === 0) return null;
    return periodAverages.reduce((a, b) => a + b, 0) / periodAverages.length;
  }, [selectedEleve, allAnnualNotes, allClassNotes, periodeId, regularPeriodes]);
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

  const filteredClasses = useMemo(() => {
    return classes.filter((c: any) => {
      const cycleName = c.niveaux?.cycles?.nom || '';
      return sectionTab === 'secondaire' ? isSecondaireCycle(cycleName) : !isSecondaireCycle(cycleName);
    });
  }, [classes, sectionTab]);

  // Group filtered classes by niveau
  const classesByNiveau = useMemo(() => {
    const groups: Record<string, { niveauNom: string; ordre: number; classes: any[] }> = {};
    filteredClasses.forEach((c: any) => {
      const niveauNom = c.niveaux?.nom || 'Autre';
      const ordre = c.niveaux?.ordre ?? 99;
      if (!groups[niveauNom]) groups[niveauNom] = { niveauNom, ordre, classes: [] };
      groups[niveauNom].classes.push(c);
    });
    return Object.values(groups).sort((a, b) => a.ordre - b.ordre);
  }, [filteredClasses]);

  if (isCoordSecondaire) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Accès non autorisé</p>
            <p className="text-sm text-muted-foreground mt-1">Les bulletins ne sont pas accessibles pour votre rôle.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Award className="h-7 w-7 text-primary" /> Bulletins Scolaires
      </h1>

      <Tabs value={sectionTab} onValueChange={(v) => { setSectionTab(v); setClasseId(''); setSelectedEleve(''); }}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="autres" className="gap-2">
            <School className="h-4 w-4" /> Préscolaire & Primaire
          </TabsTrigger>
          <TabsTrigger value="secondaire" className="gap-2">
            <GraduationCap className="h-4 w-4" /> Secondaire
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Classe</Label>
              <Select value={classeId} onValueChange={(v) => { setClasseId(v); setSelectedEleve(''); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner la classe" /></SelectTrigger>
                <SelectContent>
                  {classesByNiveau.map((group) => (
                    <div key={group.niveauNom}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {group.niveauNom}
                      </div>
                      {group.classes.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                      ))}
                    </div>
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
                  {sortedEleves.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Aucun élève</SelectItem>
                  ) : sortedEleves.map((e: any) => {
                    const rank = rankings.find((r: any) => r.id === e.id)?.rang;
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {e.prenom} {e.nom}{rank != null ? ` (Rang ${rank})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          {classeId && periodeId && sortedEleves.length > 0 && (
            <div className="mt-4 pt-4 border-t flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={pdfLoading}
                onClick={async () => {
                  setPdfLoading(true);
                  toast.info(`Génération des ${sortedEleves.length} bulletins en cours...`);
                  try {
                    // Wait for all custom fonts to be fully loaded
                    await document.fonts.ready;

                    // Iterate through each student, render bulletin, capture to PDF
                    const { default: jsPDF } = await import('jspdf');
                    const { default: html2canvas } = await import('html2canvas');
                    
                    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: false });
                    const pdfWidth = 210;
                    const pdfHeight = 297;
                    
                    for (let i = 0; i < sortedEleves.length; i++) {
                      // Select the student to render their bulletin
                      setSelectedEleve(sortedEleves[i].id);
                      setShowPrintView(true);
                      // Wait for React to render
                      await new Promise(r => setTimeout(r, 800));
                      
                      const el = document.querySelector('[data-bulletin-a4]') as HTMLElement;
                      if (!el) continue;
                      
                      const origTransform = el.style.transform;
                      el.style.transform = 'none';
                      
                      const canvas = await html2canvas(el, {
                        scale: 3,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        windowWidth: 794,
                        onclone: (clonedDoc) => {
                          const clEl = clonedDoc.querySelector('[data-bulletin-a4]') as HTMLElement;
                          if (!clEl) return;
                          clEl.style.transform = 'none';
                          clEl.style.width = '794px';
                          clEl.style.maxWidth = '794px';
                          (clEl.style as any).textRendering = 'optimizeLegibility';
                          (clEl.style as any).webkitFontSmoothing = 'antialiased';
                          (clEl.style as any).mozOsxFontSmoothing = 'grayscale';
                        },
                      });
                      
                      el.style.transform = origTransform;
                      
                      if (i > 0) pdf.addPage();
                      const imgData = canvas.toDataURL('image/png');
                      const imgW = pdfWidth;
                      const imgH = (canvas.height * pdfWidth) / canvas.width;
                      if (imgH <= pdfHeight) {
                        pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH, undefined, 'NONE');
                      } else {
                        const ratio = pdfHeight / imgH;
                        const scaledW = imgW * ratio;
                        const offsetX = (pdfWidth - scaledW) / 2;
                        pdf.addImage(imgData, 'PNG', offsetX, 0, scaledW, pdfHeight, undefined, 'NONE');
                      }
                    }
                    
                    const className = selectedCl?.nom || 'classe';
                    const periodName = periode?.nom || '';
                    pdf.save(`Bulletins_${className}_${periodName}.pdf`.replace(/\s+/g, '_'));
                    toast.success(`${sortedEleves.length} bulletins générés avec succès`);
                  } catch (e: any) {
                    toast.error(e.message || 'Erreur lors de la génération');
                  } finally {
                    setPdfLoading(false);
                  }
                }}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                {pdfLoading ? 'Génération...' : `Imprimer tous les bulletins (${sortedEleves.length})`}
              </Button>
            </div>
          )}
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
                  photo_url: eleve?.photo_url || null,
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
                plusForte={plusForte}
                plusFaible={plusFaible}
                moyenneAnnuelle={isP5 ? moyenneAnnuelle : null}
                moyenneClasse={moyenneClasse}
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
                schoolPhone={schoolConfig?.telephone}
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

              <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4`}>
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
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground">+ Forte moy.</p>
                    <p className="text-2xl font-bold text-accent">
                      {plusForte !== null ? `${plusForte.toFixed(2)}/${bareme}` : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground">+ Faible moy.</p>
                    <p className="text-2xl font-bold text-destructive">
                      {plusFaible !== null ? `${plusFaible.toFixed(2)}/${bareme}` : '—'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-accent/40">
                  <CardContent className="pt-4 pb-4 text-center">
                    <p className="text-xs text-muted-foreground">Moy. classe</p>
                    <p className="text-2xl font-bold text-accent">
                      {moyenneClasse !== null ? `${moyenneClasse.toFixed(2)}/${bareme}` : '—'}
                    </p>
                  </CardContent>
                </Card>
                {isP5 && (
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Moy. annuelle</p>
                      <p className={`text-2xl font-bold ${moyenneAnnuelle !== null && moyenneAnnuelle >= seuil ? 'text-accent' : 'text-destructive'}`}>
                        {moyenneAnnuelle !== null ? `${moyenneAnnuelle.toFixed(2)}/${bareme}` : '—'}
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
                              <TableCell className="text-center font-mono">
                                {pp.rang !== null ? `${pp.rang}e/${pp.effectif}` : '—'}
                              </TableCell>
                              <TableCell className="text-center italic">
                                {pp.mention || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
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
