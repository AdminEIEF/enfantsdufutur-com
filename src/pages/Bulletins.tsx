import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, Printer, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Bulletins() {
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [selectedEleve, setSelectedEleve] = useState('');

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-bulletin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))').order('nom');
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
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom').eq('classe_id', classeId).order('nom');
      if (error) throw error;
      return data;
    },
    enabled: !!classeId,
  });

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres-bulletin', classeId],
    queryFn: async () => {
      if (!classeId) return [];
      const cl = classes.find((c: any) => c.id === classeId);
      if (!cl) return [];
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cl.niveaux?.cycle_id).order('nom');
      if (error) throw error;
      return data;
    },
    enabled: !!classeId && classes.length > 0,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ['notes-bulletin', selectedEleve, periodeId],
    queryFn: async () => {
      if (!selectedEleve || !periodeId) return [];
      const { data, error } = await supabase.from('notes').select('*, matieres(nom, coefficient, pole)').eq('eleve_id', selectedEleve).eq('periode_id', periodeId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEleve && !!periodeId,
  });

  // All period notes for annual average
  const { data: allNotes = [] } = useQuery({
    queryKey: ['notes-annuelles', selectedEleve],
    queryFn: async () => {
      if (!selectedEleve) return [];
      const regularPeriodes = periodes.filter((p: any) => !p.est_rattrapage).map((p: any) => p.id);
      if (regularPeriodes.length === 0) return [];
      const { data, error } = await supabase.from('notes').select('*, matieres(nom, coefficient, pole)').eq('eleve_id', selectedEleve).in('periode_id', regularPeriodes);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEleve && periodes.length > 0,
  });

  const selectedCl = classes.find((c: any) => c.id === classeId);
  const isPrimaire = selectedCl?.niveaux?.cycles?.nom?.includes('Primaire') || selectedCl?.niveaux?.cycles?.nom?.includes('Crèche') || selectedCl?.niveaux?.cycles?.nom?.includes('Maternelle');
  const seuil = isPrimaire ? 6 : 12;
  const bareme = isPrimaire ? 10 : 20;

  // Period bulletin
  const bulletinData = useMemo(() => {
    return matieres.map((m: any) => {
      const n = notes.find((note: any) => note.matiere_id === m.id);
      const noteVal = n?.note ?? null;
      const coef = m.coefficient || 1;
      return { matiere: m.nom, pole: m.pole, note: noteVal, coefficient: coef, total: noteVal !== null ? noteVal * coef : null };
    });
  }, [matieres, notes]);

  const totalCoef = bulletinData.reduce((s, b) => s + b.coefficient, 0);
  const totalPoints = bulletinData.reduce((s, b) => s + (b.total || 0), 0);
  const moyennePeriode = totalCoef > 0 ? (totalPoints / totalCoef) : null;

  // Annual average
  const moyenneAnnuelle = useMemo(() => {
    if (allNotes.length === 0) return null;
    const byMatiere: Record<string, { notes: number[], coef: number }> = {};
    allNotes.forEach((n: any) => {
      if (n.note !== null && n.matieres) {
        if (!byMatiere[n.matiere_id]) byMatiere[n.matiere_id] = { notes: [], coef: n.matieres.coefficient || 1 };
        byMatiere[n.matiere_id].notes.push(n.note);
      }
    });
    let sumWeighted = 0, sumCoef = 0;
    Object.values(byMatiere).forEach(({ notes: ns, coef }) => {
      const avg = ns.reduce((a, b) => a + b, 0) / ns.length;
      sumWeighted += avg * coef;
      sumCoef += coef;
    });
    return sumCoef > 0 ? sumWeighted / sumCoef : null;
  }, [allNotes]);

  const eleve = eleves.find((e: any) => e.id === selectedEleve);
  const periode = periodes.find((p: any) => p.id === periodeId);

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Award className="h-7 w-7 text-primary" /> Bulletins Scolaires
      </h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={classeId} onValueChange={(v) => { setClasseId(v); setSelectedEleve(''); }}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Sélectionner la classe" /></SelectTrigger>
          <SelectContent>
            {classes.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={periodeId} onValueChange={setPeriodeId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Période" /></SelectTrigger>
          <SelectContent>
            {periodes.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.nom} {p.est_rattrapage ? '(Rattrapage)' : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedEleve} onValueChange={setSelectedEleve}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Sélectionner l'élève" /></SelectTrigger>
          <SelectContent>
            {eleves.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulletin */}
      {selectedEleve && periodeId ? (
        <div className="print:m-0" id="bulletin">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5" /> Bulletin de {eleve?.prenom} {eleve?.nom}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCl?.niveaux?.cycles?.nom} — {selectedCl?.niveaux?.nom} — {selectedCl?.nom} | {periode?.nom} ({periode?.annee_scolaire})
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                <Printer className="h-4 w-4 mr-2" /> Imprimer
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matière</TableHead><TableHead>Pôle</TableHead>
                    <TableHead className="text-center">Note /{bareme}</TableHead>
                    <TableHead className="text-center">Coef.</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Appréciation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulletinData.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{b.matiere}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{b.pole || '—'}</Badge></TableCell>
                      <TableCell className="text-center font-mono">{b.note !== null ? b.note.toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-center">{b.coefficient}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{b.total !== null ? b.total.toFixed(2) : '—'}</TableCell>
                      <TableCell className="text-center">
                        {b.note !== null ? (
                          <Badge variant={b.note >= seuil ? 'default' : 'destructive'} className="text-xs">
                            {b.note >= seuil * 1.5 ? 'Très Bien' : b.note >= seuil * 1.2 ? 'Bien' : b.note >= seuil ? 'Assez Bien' : 'Insuffisant'}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card className="border-primary/30">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Moyenne de la période</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${moyennePeriode !== null && moyennePeriode >= seuil ? 'text-success' : 'text-destructive'}`}>
                  {moyennePeriode !== null ? `${moyennePeriode.toFixed(2)} / ${bareme}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Moyenne annuelle</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${moyenneAnnuelle !== null && moyenneAnnuelle >= seuil ? 'text-success' : 'text-destructive'}`}>
                  {moyenneAnnuelle !== null ? `${moyenneAnnuelle.toFixed(2)} / ${bareme}` : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Décision</CardTitle></CardHeader>
              <CardContent>
                {moyennePeriode !== null ? (
                  <Badge variant={moyennePeriode >= seuil ? 'default' : 'destructive'} className="text-sm">
                    {moyennePeriode >= seuil ? 'Admis(e)' : 'Rattrapage requis'}
                  </Badge>
                ) : <span className="text-muted-foreground">—</span>}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Sélectionnez une classe, une période et un élève pour générer le bulletin.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
