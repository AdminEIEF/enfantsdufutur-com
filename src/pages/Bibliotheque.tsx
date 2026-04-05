import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library, Search, User, Award, BarChart3, FileText, ChevronRight, Printer, Lightbulb, GraduationCap, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { getOrientationRemarks } from '@/components/parent/ParentEnfantProfilRadar';
import LivresNumeriquesTab from '@/components/LivresNumeriquesTab';

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
        .select('id, nom, prenom, matricule, date_naissance, sexe, photo_url, statut, classe_id, nom_prenom_pere, nom_prenom_mere, famille_id, familles:famille_id(nom_famille, telephone_pere, telephone_mere, email_parent, adresse), classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom, bareme)))')
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

// Fetch all notes for a student across all their history
function useEleveAllNotes(eleveId: string) {
  return useQuery({
    queryKey: ['all-notes-biblio', eleveId],
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

// ─── Helpers ─────────────────────────────────────────────
const SECONDARY_CYCLES = ['collège', 'lycée', 'college', 'lycee', 'secondaire'];

function isSecondaryCycle(cycleName: string) {
  return SECONDARY_CYCLES.some(s => cycleName.toLowerCase().includes(s));
}

function computeRadar(notes: any[], bareme: number) {
  const poleMap: Record<string, { total: number; coefTotal: number }> = {};
  for (const n of notes) {
    if (n.note == null || !n.matieres?.pole) continue;
    const pole = n.matieres.pole;
    const coef = Number(n.matieres.coefficient) || 1;
    if (!poleMap[pole]) poleMap[pole] = { total: 0, coefTotal: 0 };
    poleMap[pole].total += Number(n.note) * coef;
    poleMap[pole].coefTotal += coef;
  }
  const poles = Object.keys(poleMap);
  if (poles.length === 0) return [];
  return poles
    .sort()
    .map(pole => ({
      pole,
      moyenne: poleMap[pole].coefTotal > 0 ? poleMap[pole].total / poleMap[pole].coefTotal : 0,
      fullMark: bareme,
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
    id: p.id,
    ordre: p.ordre,
    est_rattrapage: p.est_rattrapage,
    moyenne: map[p.id] ? map[p.id].total / map[p.id].coef : null,
  }));
}

function computeMatiereByPeriode(notes: any[], periodes: any[]) {
  const map: Record<string, Record<string, { total: number; count: number }>> = {};
  const matiereInfo: Record<string, { nom: string; pole: string; coef: number }> = {};
  for (const n of notes) {
    if (n.note == null) continue;
    const mid = n.matiere_id;
    const pid = n.periode_id;
    if (!matiereInfo[mid]) matiereInfo[mid] = { nom: n.matieres?.nom || '?', pole: n.matieres?.pole || '—', coef: Number(n.matieres?.coefficient) || 1 };
    if (!map[mid]) map[mid] = {};
    if (!map[mid][pid]) map[mid][pid] = { total: 0, count: 0 };
    map[mid][pid].total += Number(n.note);
    map[mid][pid].count += 1;
  }
  return Object.entries(map).map(([mid, pidMap]) => ({
    id: mid,
    ...matiereInfo[mid],
    periodes: Object.entries(pidMap).reduce((acc, [pid, v]) => {
      acc[pid] = v.count > 0 ? v.total / v.count : null;
      return acc;
    }, {} as Record<string, number | null>),
  })).sort((a, b) => a.nom.localeCompare(b.nom));
}

export default function Bibliotheque() {
  const { data: cycles = [] } = useCycles();
  const { hasRole } = useAuth();
  const isSuperviseur = hasRole('superviseur');
  const [activeTab, setActiveTab] = useState('prescolaire-primaire');
  const [cycleId, setCycleId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEleveId, setSelectedEleveId] = useState('');
  const [dossierOpen, setDossierOpen] = useState(false);
  const livretRef = useRef<HTMLDivElement>(null);
  const { data: schoolConfig } = useSchoolConfig();

  const { data: niveaux = [] } = useNiveaux(cycleId);
  const { data: classes = [] } = useClasses(niveauId);
  const { data: eleves = [] } = useElevesClasse(classeId);
  const { data: eleveNotes = [] } = useEleveNotes(selectedEleveId);
  const { data: periodes = [] } = usePeriodes();

  // Separate cycles
  const prescolairePrimaireCycles = cycles.filter((c: any) => !isSecondaryCycle(c.nom));
  const secondaireCycles = cycles.filter((c: any) => isSecondaryCycle(c.nom));
  const currentCycles = activeTab === 'prescolaire-primaire' ? prescolairePrimaireCycles : secondaireCycles;

  const selectedEleve = eleves.find((e: any) => e.id === selectedEleveId);
  const bareme = selectedEleve?.classes?.niveaux?.cycles?.bareme || 20;
  const seuil = bareme / 2;

  const filtered = eleves.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const radarData = useMemo(() => computeRadar(eleveNotes, bareme), [eleveNotes, bareme]);
  const periodeAverages = useMemo(() => computeAvgByPeriode(eleveNotes, periodes), [eleveNotes, periodes]);
  const matiereByPeriode = useMemo(() => computeMatiereByPeriode(eleveNotes, periodes), [eleveNotes, periodes]);

  const moyenneGenerale = useMemo(() => {
    const regular = periodeAverages.filter(p => !p.est_rattrapage && p.moyenne !== null);
    if (regular.length === 0) return null;
    return regular.reduce((s, p) => s + (p.moyenne || 0), 0) / regular.length;
  }, [periodeAverages]);

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCycleId('');
    setNiveauId('');
    setClasseId('');
    setSearch('');
  };

  const handlePrintLivret = () => {
    if (!livretRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Livret Scolaire - ${selectedEleve?.prenom} ${selectedEleve?.nom}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1a1a1a; font-size: 11px; }
        @media print { @page { size: A4; margin: 15mm; } }
        .header { text-align: center; border-bottom: 3px double #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
        .header h1 { font-size: 16px; margin-bottom: 2px; }
        .header h2 { font-size: 13px; font-weight: normal; color: #555; }
        .header h3 { font-size: 18px; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 16px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: #fafafa; }
        .info-grid span.label { font-weight: 600; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: center; }
        th { background: #2563eb; color: white; font-size: 10px; text-transform: uppercase; }
        td { font-size: 11px; }
        td.left { text-align: left; }
        .good { color: #16a34a; font-weight: 700; }
        .bad { color: #dc2626; font-weight: 700; }
        .summary-row { background: #f0f7ff; font-weight: 700; }
        .section-title { font-size: 13px; font-weight: 700; margin: 14px 0 6px; padding: 4px 8px; background: #e5edff; border-left: 4px solid #2563eb; }
        .radar-section { display: flex; gap: 16px; margin-bottom: 16px; }
        .radar-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .radar-bar .pole-name { width: 80px; font-weight: 600; font-size: 10px; text-align: right; }
        .radar-bar .bar-bg { flex: 1; height: 16px; background: #e5e7eb; border-radius: 8px; position: relative; overflow: hidden; }
        .radar-bar .bar-fill { height: 100%; border-radius: 8px; transition: width 0.3s; }
        .radar-bar .bar-value { width: 50px; font-weight: 700; font-size: 10px; }
        .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
        .decision-box { display: inline-block; padding: 4px 14px; border-radius: 4px; font-weight: 700; font-size: 12px; margin-top: 6px; }
        .decision-admis { background: #dcfce7; color: #16a34a; border: 1px solid #16a34a; }
        .decision-echec { background: #fef2f2; color: #dc2626; border: 1px solid #dc2626; }
      </style></head><body>
      ${livretRef.current.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  const regularPeriodes = periodes.filter((p: any) => !p.est_rattrapage);

  const renderFilters = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Cycle</Label>
            <Select value={cycleId} onValueChange={(v) => { setCycleId(v); setNiveauId(''); setClasseId(''); }}>
              <SelectTrigger><SelectValue placeholder="Choisir un cycle" /></SelectTrigger>
              <SelectContent>
                {currentCycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
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
  );

  const renderElevesList = () => (
    classeId ? (
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
    )
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Library className="h-7 w-7 text-primary" /> Bibliothèque Numérique
      </h1>

      {/* Tabs Préscolaire & Primaire / Secondaire */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className={`grid w-full max-w-lg ${isSuperviseur ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="prescolaire-primaire" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Présco. & Primaire
          </TabsTrigger>
          <TabsTrigger value="secondaire" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Secondaire
          </TabsTrigger>
          {isSuperviseur && (
            <TabsTrigger value="livres-numeriques" className="gap-2">
              📚 Livres Num.
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="prescolaire-primaire" className="space-y-4 mt-4">
          {renderFilters()}
          {renderElevesList()}
        </TabsContent>

        <TabsContent value="secondaire" className="space-y-4 mt-4">
          {renderFilters()}
          {renderElevesList()}
        </TabsContent>

        {isSuperviseur && (
          <TabsContent value="livres-numeriques" className="space-y-4 mt-4">
            <LivresNumeriquesTab />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog Dossier Élève */}
      <Dialog open={dossierOpen} onOpenChange={(open) => { setDossierOpen(open); if (!open) setSelectedEleveId(''); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Livret Unique — {selectedEleve?.prenom} {selectedEleve?.nom}
            </DialogTitle>
          </DialogHeader>

          {selectedEleve && (
            <Tabs defaultValue="synthese" className="mt-2">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="synthese">Synthèse</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="radar">Profil Radar</TabsTrigger>
                <TabsTrigger value="livret">📄 Livret</TabsTrigger>
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

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <Card className="border-primary/30">
                    <CardContent className="pt-4 pb-4 text-center">
                      <p className="text-xs text-muted-foreground">Moyenne Générale</p>
                      <p className={`text-xl font-bold ${moyenneGenerale !== null && moyenneGenerale >= seuil ? 'text-green-600' : 'text-destructive'}`}>
                        {moyenneGenerale !== null ? `${moyenneGenerale.toFixed(2)}/${bareme}` : '—'}
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

                {/* Parcours scolaire */}
                <Card className="border-amber-200 bg-gradient-to-br from-amber-500/5 to-transparent">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-amber-600" /> Parcours Scolaire
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      Ce livret unique retrace le parcours complet de l'élève, de la 1ère année d'école jusqu'au Baccalauréat.
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Cycle actuel : {selectedEleve.classes?.niveaux?.cycles?.nom || '—'}
                      </Badge>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Niveau : {selectedEleve.classes?.niveaux?.nom || '—'}
                      </Badge>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        Classe : {selectedEleve.classes?.nom || '—'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Notes ── */}
              <TabsContent value="notes" className="space-y-4 mt-4">
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
                                <span className={`font-bold ${p.moyenne >= seuil ? 'text-green-600' : 'text-destructive'}`}>
                                  {p.moyenne.toFixed(2)}/{bareme}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={p.moyenne >= seuil ? 'default' : 'destructive'}>
                                  {p.moyenne >= (bareme * 0.75) ? '🏆 Honneur' : p.moyenne >= seuil ? '✅ Admis' : '⚠️ Rattrapage'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Détail par matière</CardTitle></CardHeader>
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
                              <span className={`font-bold ${m.moyenne >= seuil ? 'text-green-600' : 'text-destructive'}`}>
                                {m.moyenne.toFixed(2)}/{bareme}
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
              <TabsContent value="radar" className="mt-4 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Profil par pôle (barème /{bareme})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {radarData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="pole" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, bareme]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                          <Radar name="Moyenne" dataKey="moyenne" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--popover-foreground))' }}
                            formatter={(value: number) => [`${value.toFixed(2)}/${bareme}`, 'Moyenne']}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>Aucune note avec pôle défini</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {radarData.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Détail par pôle</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {radarData.map((r, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{r.pole}</span>
                            <span className={`font-bold ${r.moyenne >= seuil ? 'text-green-600' : 'text-destructive'}`}>
                              {r.moyenne.toFixed(2)}/{bareme}
                            </span>
                          </div>
                          <Progress value={(r.moyenne / bareme) * 100} className="h-2.5" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {(() => {
                  const remarks = getOrientationRemarks(radarData, bareme);
                  if (!remarks || remarks.length === 0) return null;
                  return (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" /> Remarques d'orientation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {remarks.map((r, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-lg text-sm border-l-4 ${
                              r.type === 'success'
                                ? 'bg-green-50 border-green-500 text-green-800'
                                : r.type === 'warning'
                                ? 'bg-amber-50 border-amber-500 text-amber-800'
                                : 'bg-blue-50 border-blue-500 text-blue-800'
                            }`}
                          >
                            {r.text}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>

              {/* ── Livret Scolaire Imprimable ── */}
              <TabsContent value="livret" className="mt-4 space-y-4">
                <div className="flex justify-end">
                  <Button onClick={handlePrintLivret} className="gap-2">
                    <Printer className="h-4 w-4" /> Imprimer le Livret
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-6" ref={livretRef}>
                    {/* En-tête */}
                    <div className="header" style={{ textAlign: 'center', borderBottom: '3px double #1a1a1a', paddingBottom: 12, marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>RÉPUBLIQUE DE GUINÉE</div>
                      <div style={{ fontSize: 10, fontStyle: 'italic', color: '#555', marginTop: 2 }}>Travail - Justice - Solidarité</div>
                      <div style={{ margin: '8px 0', borderTop: '1px solid #ccc', width: '40%', marginLeft: '30%' }} />
                      <h1 style={{ fontSize: 16, margin: '4px 0' }}>{schoolConfig?.nom || 'Établissement Scolaire'}</h1>
                      <div style={{ fontSize: 11, color: '#555' }}>{schoolConfig?.soustitre} — {schoolConfig?.ville}</div>
                      <h3 style={{ fontSize: 18, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 }}>LIVRET SCOLAIRE</h3>
                      <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>Document de suivi du parcours scolaire — De la 1ère Année au Baccalauréat</div>
                    </div>

                    {/* Infos élève */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 16, padding: 10, border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }}>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Nom : </span>{selectedEleve.nom}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Prénom : </span>{selectedEleve.prenom}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Matricule : </span>{selectedEleve.matricule || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Date de naissance : </span>{selectedEleve.date_naissance ? new Date(selectedEleve.date_naissance).toLocaleDateString('fr-FR') : '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Sexe : </span>{selectedEleve.sexe || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Classe : </span>{selectedEleve.classes?.niveaux?.cycles?.nom} — {selectedEleve.classes?.niveaux?.nom} — {selectedEleve.classes?.nom}</div>
                    </div>

                    {/* Renseignements Parent / Tuteur */}
                    <div style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 6px', padding: '4px 8px', background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
                      Renseignements du Parent / Tuteur
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 10, padding: 10, border: '1px solid #ddd', borderRadius: 6, background: '#fafafa' }}>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Nom & Prénom du Père : </span>{selectedEleve.nom_prenom_pere || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Nom & Prénom de la Mère : </span>{selectedEleve.nom_prenom_mere || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Profession : </span>..........................................</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Lien avec le tuteur : </span>..........................................</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Téléphone Père : </span>{(selectedEleve as any).familles?.telephone_pere || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Téléphone Mère : </span>{(selectedEleve as any).familles?.telephone_mere || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Adresse / Domicile : </span>{(selectedEleve as any).familles?.adresse || '—'}</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Lieu de travail : </span>..........................................</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Email : </span>{(selectedEleve as any).familles?.email_parent || '—'}</div>
                    </div>

                    {/* Tableau changement d'adresse */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10, fontSize: 10 }}>
                      <thead>
                        <tr>
                          <th colSpan={3} style={{ border: '1px solid #bbb', padding: '4px 8px', background: '#e5edff', fontWeight: 700, fontSize: 11 }}>Changement d'adresse</th>
                        </tr>
                        <tr>
                          <th style={{ border: '1px solid #bbb', padding: '4px 8px', background: '#f0f0f0', fontWeight: 600, width: '33%' }}>Date</th>
                          <th style={{ border: '1px solid #bbb', padding: '4px 8px', background: '#f0f0f0', fontWeight: 600, width: '33%' }}>Domicile / Ville</th>
                          <th style={{ border: '1px solid #bbb', padding: '4px 8px', background: '#f0f0f0', fontWeight: 600, width: '34%' }}>École</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map(i => (
                          <tr key={i}>
                            <td style={{ border: '1px solid #bbb', padding: '6px 8px', height: 24 }}>&nbsp;</td>
                            <td style={{ border: '1px solid #bbb', padding: '6px 8px', height: 24 }}>&nbsp;</td>
                            <td style={{ border: '1px solid #bbb', padding: '6px 8px', height: 24 }}>&nbsp;</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Situation familiale */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', marginBottom: 10, padding: 10, border: '1px solid #ddd', borderRadius: 6, background: '#fafafa', fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, color: '#555' }}>Situation familiale :</span>
                      </div>
                      <div>&nbsp;</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '1.5px solid #555', borderRadius: 2 }}></span>
                        <span>Parents séparés</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '1.5px solid #555', borderRadius: 2 }}></span>
                        <span>Orphelin de père</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '1.5px solid #555', borderRadius: 2 }}></span>
                        <span>Orphelin de mère</span>
                      </div>
                      <div>&nbsp;</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Date de 1ère rentrée scolaire : </span>..........................................</div>
                      <div><span style={{ fontWeight: 600, color: '#555' }}>Venant de l'école : </span>..........................................</div>
                    </div>

                    {/* Parcours info */}
                    <div style={{ fontSize: 11, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 6, marginBottom: 16 }}>
                      <strong>📋 Parcours scolaire :</strong> Ce livret retrace l'ensemble du parcours académique de l'élève, du cycle {selectedEleve.classes?.niveaux?.cycles?.nom || '—'}, niveau {selectedEleve.classes?.niveaux?.nom || '—'}.
                    </div>

                    {/* Tableau des notes par matière et période */}
                    <div style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 6px', padding: '4px 8px', background: '#e5edff', borderLeft: '4px solid #2563eb' }}>
                      Notes par matière et par période (/{bareme})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                      <thead>
                        <tr>
                          <th style={{ border: '1px solid #bbb', padding: '5px 8px', background: '#2563eb', color: 'white', fontSize: 10, textAlign: 'left' }}>Matière</th>
                          <th style={{ border: '1px solid #bbb', padding: '5px 8px', background: '#2563eb', color: 'white', fontSize: 10 }}>Pôle</th>
                          <th style={{ border: '1px solid #bbb', padding: '5px 8px', background: '#2563eb', color: 'white', fontSize: 10 }}>Coef</th>
                          {regularPeriodes.map((p: any) => (
                            <th key={p.id} style={{ border: '1px solid #bbb', padding: '5px 8px', background: '#2563eb', color: 'white', fontSize: 10 }}>{p.nom}</th>
                          ))}
                          <th style={{ border: '1px solid #bbb', padding: '5px 8px', background: '#1d4ed8', color: 'white', fontSize: 10 }}>Moy. Année</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matiereByPeriode.length === 0 ? (
                          <tr><td colSpan={4 + regularPeriodes.length} style={{ textAlign: 'center', padding: 16, color: '#888', border: '1px solid #bbb' }}>Aucune donnée</td></tr>
                        ) : matiereByPeriode.map((m) => {
                          const vals = regularPeriodes.map((p: any) => m.periodes[p.id]).filter((v): v is number => v !== null && v !== undefined);
                          const moyAnnee = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                          return (
                            <tr key={m.id}>
                              <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'left', fontWeight: 600 }}>{m.nom}</td>
                              <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontSize: 10 }}>{m.pole}</td>
                              <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center' }}>{m.coef}</td>
                              {regularPeriodes.map((p: any) => {
                                const v = m.periodes[p.id];
                                return (
                                  <td key={p.id} style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: v != null ? (v >= seuil ? '#16a34a' : '#dc2626') : '#888' }}>
                                    {v != null ? v.toFixed(2) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 700, background: '#f0f7ff', color: moyAnnee != null ? (moyAnnee >= seuil ? '#16a34a' : '#dc2626') : '#888' }}>
                                {moyAnnee != null ? moyAnnee.toFixed(2) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: '#f0f7ff', fontWeight: 700 }}>
                          <td colSpan={3} style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'right' }}>MOYENNE GÉNÉRALE</td>
                          {regularPeriodes.map((p: any) => {
                            const avg = periodeAverages.find(pa => pa.id === p.id);
                            return (
                              <td key={p.id} style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: avg?.moyenne != null ? (avg.moyenne >= seuil ? '#16a34a' : '#dc2626') : '#888' }}>
                                {avg?.moyenne != null ? avg.moyenne.toFixed(2) : '—'}
                              </td>
                            );
                          })}
                          <td style={{ border: '1px solid #bbb', padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: moyenneGenerale != null ? (moyenneGenerale >= seuil ? '#16a34a' : '#dc2626') : '#888' }}>
                            {moyenneGenerale != null ? `${moyenneGenerale.toFixed(2)}/${bareme}` : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Profil radar en barres */}
                    <div style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 6px', padding: '4px 8px', background: '#e5edff', borderLeft: '4px solid #2563eb' }}>
                      Profil d'orientation par pôle
                    </div>
                    {radarData.length > 0 ? (
                      <div style={{ marginBottom: 16 }}>
                        {radarData.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 90, fontWeight: 600, fontSize: 10, textAlign: 'right' }}>{r.pole}</span>
                            <div style={{ flex: 1, height: 16, background: '#e5e7eb', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                              <div style={{ height: '100%', width: `${(r.moyenne / bareme) * 100}%`, borderRadius: 8, background: r.moyenne >= seuil ? '#22c55e' : '#ef4444' }} />
                            </div>
                            <span style={{ width: 55, fontWeight: 700, fontSize: 10, color: r.moyenne >= seuil ? '#16a34a' : '#dc2626' }}>{r.moyenne.toFixed(2)}/{bareme}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontSize: 11, marginBottom: 16 }}>Aucune donnée de pôle disponible</p>
                    )}

                    {/* Décision */}
                    <div style={{ textAlign: 'center', marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Décision finale :</div>
                      {moyenneGenerale !== null ? (
                        <span style={{
                          display: 'inline-block', padding: '4px 14px', borderRadius: 4, fontWeight: 700, fontSize: 13,
                          background: moyenneGenerale >= seuil ? '#dcfce7' : '#fef2f2',
                          color: moyenneGenerale >= seuil ? '#16a34a' : '#dc2626',
                          border: `1px solid ${moyenneGenerale >= seuil ? '#16a34a' : '#dc2626'}`
                        }}>
                          {moyenneGenerale >= (bareme * 0.75) ? '🏆 Admis(e) avec Honneur' : moyenneGenerale >= seuil ? '✅ Admis(e)' : '⚠️ Doit redoubler'}
                        </span>
                      ) : <span style={{ color: '#888' }}>—</span>}
                    </div>

                    {/* Signatures */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 30, fontSize: 11 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: 30 }}>L'Enseignant(e)</div>
                        <div style={{ borderTop: '1px solid #aaa', paddingTop: 4 }}>Signature</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: 30 }}>Le Parent / Tuteur</div>
                        <div style={{ borderTop: '1px solid #aaa', paddingTop: 4 }}>Signature</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, marginBottom: 30 }}>Le Directeur</div>
                        <div style={{ borderTop: '1px solid #aaa', paddingTop: 4 }}>Signature & Cachet</div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, color: '#888', borderTop: '1px solid #ddd', paddingTop: 8 }}>
                      {schoolConfig?.nom} — {schoolConfig?.ville} — {schoolConfig?.telephone ? `Tél: ${schoolConfig.telephone}` : ''} — Année scolaire {new Date().getFullYear() - 1}/{new Date().getFullYear()}
                    </div>
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
