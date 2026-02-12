import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux(nom, cycle_id, cycles(nom))');
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

function useElevesClasse(classeId: string) {
  return useQuery({
    queryKey: ['eleves-classe', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule')
        .eq('classe_id', classeId)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function useMatieresCycle(cycleId: string) {
  return useQuery({
    queryKey: ['matieres-cycle', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matieres')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function useNotesEleve(eleveId: string) {
  return useQuery({
    queryKey: ['notes-eleve', eleveId],
    enabled: !!eleveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*, matieres(nom, pole, coefficient), periodes(nom, ordre)')
        .eq('eleve_id', eleveId);
      if (error) throw error;
      return data;
    },
  });
}

// Poles for radar
const DEFAULT_POLES = ['Littéraire', 'Scientifique', 'Expérimentale'];

function getSuggestion(radarData: { pole: string; moyenne: number }[]): { orientation: string; detail: string; color: string } {
  if (!radarData.length) return { orientation: '—', detail: 'Données insuffisantes', color: 'text-muted-foreground' };

  const sorted = [...radarData].sort((a, b) => b.moyenne - a.moyenne);
  const best = sorted[0];
  const secondBest = sorted[1];

  if (best.moyenne >= 14) {
    if (best.pole === 'Scientifique') return { orientation: 'Filière Scientifique', detail: `Excellent profil scientifique (${best.moyenne.toFixed(1)}/20)`, color: 'text-primary' };
    if (best.pole === 'Littéraire') return { orientation: 'Filière Littéraire', detail: `Fort potentiel littéraire (${best.moyenne.toFixed(1)}/20)`, color: 'text-accent' };
    if (best.pole === 'Expérimentale') return { orientation: 'Filière Expérimentale', detail: `Fort potentiel expérimental (${best.moyenne.toFixed(1)}/20)`, color: 'text-primary' };
    return { orientation: `Spécialisation ${best.pole}`, detail: `Forte aptitude en ${best.pole} (${best.moyenne.toFixed(1)}/20)`, color: 'text-primary' };
  }
  if (best.moyenne >= 10) {
    return { orientation: 'Filière Générale', detail: `Profil équilibré, meilleur en ${best.pole} (${best.moyenne.toFixed(1)}/20)`, color: 'text-secondary' };
  }
  return { orientation: 'Soutien recommandé', detail: `Moyennes faibles, renforcement nécessaire`, color: 'text-destructive' };
}

export default function Orientation() {
  const { data: classes = [] } = useClasses();
  const { data: periodes = [] } = usePeriodes();
  const [classeId, setClasseId] = useState('');
  const [eleveId, setEleveId] = useState('');
  const [periodeId, setPeriodeId] = useState('');

  const selectedClasse = classes.find((c: any) => c.id === classeId);
  const cycleId = selectedClasse?.niveaux?.cycle_id || '';

  const { data: eleves = [] } = useElevesClasse(classeId);
  const { data: matieres = [] } = useMatieresCycle(cycleId);
  const { data: notes = [] } = useNotesEleve(eleveId);

  const selectedEleve = eleves.find((e: any) => e.id === eleveId);

  // Calculate radar data: moyenne par pôle
  const radarData = useMemo(() => {
    if (!notes.length || !matieres.length) return [];

    // Filter notes by period if selected
    const filteredNotes = periodeId
      ? notes.filter((n: any) => n.periode_id === periodeId)
      : notes;

    // Group by pole
    const poleMap: Record<string, { total: number; coefTotal: number }> = {};

    for (const n of filteredNotes) {
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
  }, [notes, matieres, periodeId]);

  // Per-matière averages
  const matiereAverages = useMemo(() => {
    if (!notes.length) return [];

    const filteredNotes = periodeId
      ? notes.filter((n: any) => n.periode_id === periodeId)
      : notes;

    const map: Record<string, { nom: string; pole: string; total: number; count: number; coef: number }> = {};
    for (const n of filteredNotes) {
      if (n.note == null) continue;
      const mid = n.matiere_id;
      if (!map[mid]) map[mid] = { nom: n.matieres?.nom || '?', pole: n.matieres?.pole || '—', total: 0, count: 0, coef: Number(n.matieres?.coefficient) || 1 };
      map[mid].total += Number(n.note);
      map[mid].count += 1;
    }

    return Object.values(map)
      .map(m => ({ ...m, moyenne: m.count > 0 ? m.total / m.count : 0 }))
      .sort((a, b) => b.moyenne - a.moyenne);
  }, [notes, periodeId]);

  const suggestion = getSuggestion(radarData as any);

  // Global average
  const moyenneGenerale = useMemo(() => {
    if (!matiereAverages.length) return 0;
    let totalWeighted = 0, totalCoef = 0;
    for (const m of matiereAverages) {
      totalWeighted += m.moyenne * m.coef;
      totalCoef += m.coef;
    }
    return totalCoef > 0 ? totalWeighted / totalCoef : 0;
  }, [matiereAverages]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BarChart3 className="h-7 w-7 text-primary" /> Orientation
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Classe</Label>
              <Select value={classeId} onValueChange={(v) => { setClasseId(v); setEleveId(''); }}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Élève</Label>
              <Select value={eleveId} onValueChange={setEleveId}>
                <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
                <SelectContent>
                  {eleves.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Aucun élève</SelectItem>
                  ) : eleves.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Période</Label>
              <Select value={periodeId || '__all__'} onValueChange={(v) => setPeriodeId(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Toutes périodes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes périodes</SelectItem>
                  {periodes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {eleveId && selectedEleve ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Moyenne générale</p>
                    <p className="text-2xl font-bold">{moyenneGenerale.toFixed(2)} / 20</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Award className="h-8 w-8 text-accent" />
                  <div>
                    <p className="text-sm text-muted-foreground">Meilleur pôle</p>
                    <p className="text-2xl font-bold">
                      {radarData.length > 0 ? [...radarData].sort((a, b) => b.moyenne - a.moyenne)[0].pole : '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${suggestion.color === 'text-primary' ? 'border-l-primary' : suggestion.color === 'text-accent' ? 'border-l-accent' : suggestion.color === 'text-destructive' ? 'border-l-destructive' : 'border-l-secondary'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <BarChart3 className={`h-8 w-8 ${suggestion.color}`} />
                  <div>
                    <p className="text-sm text-muted-foreground">Suggestion d'orientation</p>
                    <p className={`text-lg font-bold ${suggestion.color}`}>{suggestion.orientation}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.detail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profil par pôle — {selectedEleve.prenom} {selectedEleve.nom}</CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="pole" tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 20]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                      <Radar
                        name="Moyenne"
                        dataKey="moyenne"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--popover-foreground))',
                        }}
                        formatter={(value: number) => [`${value.toFixed(2)} / 20`, 'Moyenne']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Aucune note avec pôle trouvée</p>
                      <p className="text-xs">Vérifiez que les matières ont un pôle défini dans la Configuration</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Matière breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Détail par matière</CardTitle>
              </CardHeader>
              <CardContent>
                {matiereAverages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Aucune note disponible</p>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {matiereAverages.map((m, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{m.nom}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{m.pole}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(m.moyenne / 20) * 100}%`,
                                backgroundColor: m.moyenne >= 14 ? 'hsl(var(--accent))' : m.moyenne >= 10 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                              }}
                            />
                          </div>
                          <span className={`text-sm font-bold w-14 text-right ${m.moyenne >= 14 ? 'text-accent' : m.moyenne >= 10 ? 'text-primary' : 'text-destructive'}`}>
                            {m.moyenne.toFixed(1)}/20
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Sélectionnez une classe et un élève pour visualiser son profil d'orientation</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
