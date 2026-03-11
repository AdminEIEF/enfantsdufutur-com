import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { sortClasses } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function MesClasses() {
  const [selectedCycle, setSelectedCycle] = useState('all');
  // Per-class search filters
  const [classSearches, setClassSearches] = useState<Record<string, string>>({});

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['mes-classes-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, sexe, photo_url, classe_id, classes(id, nom, niveau_id, niveaux:niveau_id(id, nom, ordre, cycle_id, cycles:cycle_id(id, nom, ordre)))')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['mes-classes-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom, niveau_id, capacite, niveaux:niveau_id(id, nom, ordre, cycle_id, cycles:cycle_id(id, nom, ordre))');
      if (error) throw error;
      return sortClasses(data || []);
    },
  });

  // Build cycle list
  const cycles = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; ordre: number }>();
    classes.forEach((c: any) => {
      const cycle = c.niveaux?.cycles;
      if (cycle && !map.has(cycle.id)) {
        map.set(cycle.id, { id: cycle.id, nom: cycle.nom, ordre: cycle.ordre });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.ordre - b.ordre);
  }, [classes]);

  // Count per cycle
  const cycleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: eleves.length };
    eleves.forEach((e: any) => {
      const cycleId = e.classes?.niveaux?.cycles?.id;
      if (cycleId) counts[cycleId] = (counts[cycleId] || 0) + 1;
    });
    return counts;
  }, [eleves]);

  // Filter eleves by cycle
  const filteredEleves = useMemo(() => {
    if (selectedCycle === 'all') return eleves;
    return eleves.filter((e: any) => e.classes?.niveaux?.cycles?.id === selectedCycle);
  }, [eleves, selectedCycle]);

  // Group: cycle -> niveau -> classe
  const structure = useMemo(() => {
    const filteredClasses = selectedCycle === 'all'
      ? classes
      : classes.filter((c: any) => c.niveaux?.cycles?.id === selectedCycle);

    const niveauMap = new Map<string, { id: string; nom: string; ordre: number; classes: any[] }>();

    filteredClasses.forEach((c: any) => {
      const niv = c.niveaux;
      if (!niv) return;
      if (!niveauMap.has(niv.id)) {
        niveauMap.set(niv.id, { id: niv.id, nom: niv.nom, ordre: niv.ordre, classes: [] });
      }
      niveauMap.get(niv.id)!.classes.push(c);
    });

    return Array.from(niveauMap.values()).sort((a, b) => a.ordre - b.ordre);
  }, [classes, selectedCycle]);

  // Get eleves for a class, filtered by per-class search
  const getClassEleves = (classeId: string) => {
    const classEleves = filteredEleves.filter((e: any) => e.classe_id === classeId);
    const search = (classSearches[classeId] || '').toLowerCase().trim();
    if (!search) return classEleves;
    const terms = search.split(/\s+/);
    return classEleves.filter((e: any) => {
      const text = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase();
      return terms.some(t => text.includes(t));
    });
  };

  const setClassSearch = (classeId: string, value: string) => {
    setClassSearches(prev => ({ ...prev, [classeId]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Mes Classes</h1>
      </div>

      {/* Cycle tabs */}
      <Tabs value={selectedCycle} onValueChange={setSelectedCycle}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
            <Users className="h-4 w-4 mr-1.5" />
            Tous
            <Badge variant="secondary" className="ml-1.5 text-xs bg-primary/20 data-[state=active]:bg-primary-foreground/20">
              {cycleCounts.all || 0}
            </Badge>
          </TabsTrigger>
          {cycles.map(cycle => (
            <TabsTrigger key={cycle.id} value={cycle.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
              {cycle.nom}
              <Badge variant="secondary" className="ml-1.5 text-xs bg-primary/20">
                {cycleCounts[cycle.id] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content (same for all tabs, filtered by selectedCycle) */}
        {['all', ...cycles.map(c => c.id)].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4 space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : structure.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune classe trouvée</CardContent></Card>
            ) : (
              <Accordion type="multiple" defaultValue={structure.map(n => n.id)}>
                {structure.map(niveau => {
                  const niveauEleves = filteredEleves.filter((e: any) => e.classes?.niveaux?.id === niveau.id);
                  return (
                    <AccordionItem key={niveau.id} value={niveau.id} className="border rounded-lg mb-3 overflow-hidden">
                      <AccordionTrigger className="px-4 py-3 bg-muted/30 hover:bg-muted/50 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{niveau.nom}</span>
                          <Badge variant="outline" className="ml-1">{niveauEleves.length} élèves</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <div className="divide-y">
                          {niveau.classes.map((cls: any) => {
                            const classEleves = getClassEleves(cls.id);
                            const totalInClass = filteredEleves.filter((e: any) => e.classe_id === cls.id).length;
                            return (
                              <div key={cls.id} className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-base">{cls.nom}</h3>
                                    <Badge className="bg-primary/10 text-primary border-primary/20">{totalInClass} élèves</Badge>
                                    {cls.capacite && (
                                      <span className="text-xs text-muted-foreground">/ {cls.capacite} places</span>
                                    )}
                                  </div>
                                  <div className="relative w-56">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Filtrer nom / matricule..."
                                      className="pl-8 h-9 text-sm"
                                      value={classSearches[cls.id] || ''}
                                      onChange={e => setClassSearch(cls.id, e.target.value)}
                                    />
                                  </div>
                                </div>
                                {classEleves.length === 0 ? (
                                  <p className="text-sm text-muted-foreground py-2 text-center">
                                    {totalInClass === 0 ? 'Aucun élève inscrit' : 'Aucun résultat'}
                                  </p>
                                ) : (
                                  <div className="border rounded-md overflow-hidden">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-muted/20">
                                          <TableHead className="w-10">#</TableHead>
                                          <TableHead>Photo</TableHead>
                                          <TableHead>Nom</TableHead>
                                          <TableHead>Prénom</TableHead>
                                          <TableHead>Matricule</TableHead>
                                          <TableHead>Sexe</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {classEleves.map((eleve: any, idx: number) => (
                                          <TableRow key={eleve.id}>
                                            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                            <TableCell>
                                              {eleve.photo_url ? (
                                                <img src={eleve.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                                              ) : (
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                  {eleve.prenom?.[0]}{eleve.nom?.[0]}
                                                </div>
                                              )}
                                            </TableCell>
                                            <TableCell className="font-medium">{eleve.nom}</TableCell>
                                            <TableCell>{eleve.prenom}</TableCell>
                                            <TableCell><Badge variant="outline" className="font-mono text-xs">{eleve.matricule || '—'}</Badge></TableCell>
                                            <TableCell>{eleve.sexe === 'M' ? '♂' : eleve.sexe === 'F' ? '♀' : '—'}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
