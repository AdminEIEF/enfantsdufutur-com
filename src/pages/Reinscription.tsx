import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, Users, CheckCircle2, ArrowUpCircle, AlertTriangle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Hooks ───────────────────────────────────────────────
function useAllEleves() {
  return useQuery({
    queryKey: ['eleves-reinscription'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, statut, classe_id, famille_id, classes(nom, niveau_id, niveaux:niveau_id(nom, ordre, cycle_id, cycles:cycle_id(nom, ordre)))')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function useNiveaux() {
  return useQuery({
    queryKey: ['niveaux-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('niveaux')
        .select('*, cycles:cycle_id(nom, ordre)')
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

function useClassesAll() {
  return useQuery({
    queryKey: ['classes-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, niveaux:niveau_id(nom, ordre, cycle_id, cycles:cycle_id(nom, ordre))')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

// Determine next level for a student
function getNextNiveau(currentNiveau: any, allNiveaux: any[]) {
  if (!currentNiveau) return null;
  const currentCycleOrdre = currentNiveau.cycles?.ordre ?? 0;
  const currentOrdre = currentNiveau.ordre ?? 0;

  // Same cycle, next ordre
  const sameCycleNext = allNiveaux.find(
    (n: any) => n.cycle_id === currentNiveau.cycle_id && n.ordre === currentOrdre + 1
  );
  if (sameCycleNext) return sameCycleNext;

  // Next cycle, first niveau
  const nextCycleNiveaux = allNiveaux
    .filter((n: any) => (n.cycles?.ordre ?? 0) === currentCycleOrdre + 1)
    .sort((a: any, b: any) => a.ordre - b.ordre);
  return nextCycleNiveaux[0] || null;
}

export default function Reinscription() {
  const qc = useQueryClient();
  const { data: eleves = [], isLoading } = useAllEleves();
  const { data: niveaux = [] } = useNiveaux();
  const { data: allClasses = [] } = useClassesAll();
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<string>('tous');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetClasses, setTargetClasses] = useState<Record<string, string>>({});

  // Stats
  const totalEleves = eleves.length;
  const inscrits = eleves.filter((e: any) => e.statut === 'inscrit').length;
  const reinscrits = eleves.filter((e: any) => e.statut === 'réinscrit').length;
  const aReinscrire = eleves.filter((e: any) => e.statut === 'à réinscrire').length;

  // Filter
  const filtered = useMemo(() => {
    return eleves.filter((e: any) => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchStatut = filterStatut === 'tous' || e.statut === filterStatut;
      return matchSearch && matchStatut;
    });
  }, [eleves, search, filterStatut]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((e: any) => e.id)));
    }
  };

  // Mark as "à réinscrire"
  const markForReinscription = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from('eleves')
        .update({ statut: 'à réinscrire' })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-reinscription'] });
      toast.success(`${selected.size} élève(s) marqué(s) "À réinscrire"`);
      setSelected(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Open confirm dialog for promotion
  const openPromotion = () => {
    // Pre-compute target classes
    const targets: Record<string, string> = {};
    for (const id of selected) {
      const eleve = eleves.find((e: any) => e.id === id);
      if (!eleve?.classes?.niveaux) continue;
      const nextNiv = getNextNiveau(eleve.classes.niveaux, niveaux);
      if (nextNiv) {
        const firstClass = allClasses.find((c: any) => c.niveau_id === nextNiv.id);
        if (firstClass) targets[id] = firstClass.id;
      }
    }
    setTargetClasses(targets);
    setConfirmOpen(true);
  };

  // Execute re-inscription with promotion
  const executeReinscription = useMutation({
    mutationFn: async () => {
      const promises = Array.from(selected).map(async (eleveId) => {
        const targetClasseId = targetClasses[eleveId];
        const updateData: any = { statut: 'réinscrit' };
        if (targetClasseId) updateData.classe_id = targetClasseId;

        const { error } = await supabase
          .from('eleves')
          .update(updateData)
          .eq('id', eleveId);
        if (error) throw error;
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-reinscription'] });
      toast.success(`${selected.size} élève(s) réinscrit(s) avec promotion au niveau supérieur`);
      setSelected(new Set());
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getClasseLabel = (classeId: string) => {
    const c = allClasses.find((cl: any) => cl.id === classeId);
    if (!c) return '—';
    return `${c.niveaux?.cycles?.nom} — ${c.niveaux?.nom} — ${c.nom}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <RefreshCw className="h-7 w-7 text-primary" /> Réinscription
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total élèves</p>
                <p className="text-2xl font-bold">{totalEleves}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Inscrits</p>
                <p className="text-2xl font-bold">{inscrits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">À réinscrire</p>
                <p className="text-2xl font-bold text-warning">{aReinscrire}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-sm text-muted-foreground">Réinscrits</p>
                <p className="text-2xl font-bold text-secondary">{reinscrits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            <SelectItem value="inscrit">Inscrits</SelectItem>
            <SelectItem value="à réinscrire">À réinscrire</SelectItem>
            <SelectItem value="réinscrit">Réinscrits</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => markForReinscription.mutate()} disabled={selected.size === 0 || markForReinscription.isPending}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Marquer "À réinscrire" ({selected.size})
          </Button>
          <Button onClick={openPromotion} disabled={selected.size === 0}>
            <ArrowUpCircle className="h-4 w-4 mr-2" /> Réinscrire + Promouvoir ({selected.size})
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={selectAll} />
                </TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Classe actuelle</TableHead>
                <TableHead>Niveau suivant</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filtered.map((e: any) => {
                const nextNiv = e.classes?.niveaux ? getNextNiveau(e.classes.niveaux, niveaux) : null;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                    <TableCell>{e.matricule || '—'}</TableCell>
                    <TableCell>
                      {e.classes ? (
                        <span className="text-sm">
                          {e.classes.niveaux?.cycles?.nom} — {e.classes.niveaux?.nom} — {e.classes.nom}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {nextNiv ? (
                        <Badge variant="outline" className="text-xs">
                          {nextNiv.cycles?.nom} — {nextNiv.nom}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Fin de parcours</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={e.statut === 'réinscrit' ? 'default' : e.statut === 'à réinscrire' ? 'destructive' : 'secondary'}
                      >
                        {e.statut}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmer la réinscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Les {selected.size} élève(s) sélectionné(s) seront réinscrits et promus au niveau supérieur :
            </p>
            {Array.from(selected).map(id => {
              const eleve = eleves.find((e: any) => e.id === id);
              if (!eleve) return null;
              return (
                <div key={id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                  <span className="font-medium text-sm">{eleve.prenom} {eleve.nom}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{eleve.classes?.nom || '—'}</span>
                    <ArrowUpCircle className="h-3 w-3 text-primary" />
                    <span className="text-primary font-medium">
                      {targetClasses[id] ? getClasseLabel(targetClasses[id]) : 'Fin de parcours'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button onClick={() => executeReinscription.mutate()} disabled={executeReinscription.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmer la réinscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
