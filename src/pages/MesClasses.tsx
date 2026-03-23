import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, GraduationCap, ArrowDownAZ, Hash, Download, TrendingUp, BarChart3, School } from 'lucide-react';
import { exportToExcel } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { sortClasses } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Progress } from '@/components/ui/progress';

const SECONDAIRE_CYCLES = ['collège', 'lycée', 'college', 'lycee'];
const isSecondaireCycle = (cycleName: string) => SECONDAIRE_CYCLES.some(c => (cycleName || '').toLowerCase().includes(c));

export default function MesClasses() {
  const [selectedTab, setSelectedTab] = useState('secondaire');
  const [classSorts, setClassSorts] = useState<Record<string, 'nom' | 'matricule'>>({});
  const [classSearches, setClassSearches] = useState<Record<string, string>>({});
  const { data: schoolConfig } = useSchoolConfig();

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['mes-classes-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, sexe, photo_url, classe_id, classes(id, nom, niveau_id, capacite, niveaux:niveau_id(id, nom, ordre, cycle_id, cycles:cycle_id(id, nom, ordre)))')
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

  const secondaireCount = useMemo(() => {
    return eleves.filter((e: any) => isSecondaireCycle(e.classes?.niveaux?.cycles?.nom || '')).length;
  }, [eleves]);
  const autresCount = eleves.length - secondaireCount;

  const filteredEleves = useMemo(() => {
    return eleves.filter((e: any) => {
      const cycleName = e.classes?.niveaux?.cycles?.nom || '';
      return selectedTab === 'secondaire' ? isSecondaireCycle(cycleName) : !isSecondaireCycle(cycleName);
    });
  }, [eleves, selectedTab]);

  const structure = useMemo(() => {
    const filteredClasses = classes.filter((c: any) => {
      const cycleName = c.niveaux?.cycles?.nom || '';
      return selectedTab === 'secondaire' ? isSecondaireCycle(cycleName) : !isSecondaireCycle(cycleName);
    });

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
  }, [classes, selectedTab]);

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    const totalEleves = filteredEleves.length;
    const garcons = filteredEleves.filter((e: any) => e.sexe === 'M').length;
    const filles = filteredEleves.filter((e: any) => e.sexe === 'F').length;
    const totalClasses = structure.reduce((sum, n) => sum + n.classes.length, 0);
    const totalNiveaux = structure.length;

    // Capacité totale et taux de remplissage
    let totalCapacite = 0;
    let classesAvecCapacite = 0;
    structure.forEach(n => {
      n.classes.forEach((c: any) => {
        if (c.capacite) {
          totalCapacite += c.capacite;
          classesAvecCapacite++;
        }
      });
    });
    const tauxRemplissage = totalCapacite > 0 ? Math.round((totalEleves / totalCapacite) * 100) : 0;

    // Classe la plus remplie
    let classeMax = { nom: '—', effectif: 0 };
    structure.forEach(n => {
      n.classes.forEach((c: any) => {
        const effectif = filteredEleves.filter((e: any) => e.classe_id === c.id).length;
        if (effectif > classeMax.effectif) {
          classeMax = { nom: c.nom, effectif };
        }
      });
    });

    return { totalEleves, garcons, filles, totalClasses, totalNiveaux, tauxRemplissage, totalCapacite, classeMax };
  }, [filteredEleves, structure]);

  const getClassStats = (classeId: string) => {
    const all = filteredEleves.filter((e: any) => e.classe_id === classeId);
    const garcons = all.filter((e: any) => e.sexe === 'M').length;
    const filles = all.filter((e: any) => e.sexe === 'F').length;
    return { total: all.length, garcons, filles };
  };

  const getClassEleves = (classeId: string) => {
    let classEleves = filteredEleves.filter((e: any) => e.classe_id === classeId);
    const search = (classSearches[classeId] || '').toLowerCase().trim();
    if (search) {
      const terms = search.split(/\s+/);
      classEleves = classEleves.filter((e: any) => {
        const text = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase();
        return terms.some(t => text.includes(t));
      });
    }
    const sortMode = classSorts[classeId] || 'nom';
    return [...classEleves].sort((a: any, b: any) => {
      if (sortMode === 'matricule') {
        return (a.matricule || '').localeCompare(b.matricule || '', 'fr', { numeric: true });
      }
      const nomA = (a.nom || '').toUpperCase();
      const nomB = (b.nom || '').toUpperCase();
      if (nomA < nomB) return -1;
      if (nomA > nomB) return 1;
      const prenomA = (a.prenom || '').toUpperCase();
      const prenomB = (b.prenom || '').toUpperCase();
      if (prenomA < prenomB) return -1;
      if (prenomA > prenomB) return 1;
      return 0;
    });
  };

  const setClassSearch = (classeId: string, value: string) => {
    setClassSearches(prev => ({ ...prev, [classeId]: value }));
  };

  const toggleClassSort = (classeId: string) => {
    setClassSorts(prev => ({
      ...prev,
      [classeId]: (prev[classeId] || 'nom') === 'nom' ? 'matricule' : 'nom',
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Mes Classes</h1>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="secondaire" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
            <GraduationCap className="h-4 w-4 mr-1.5" />
            Secondaire
            <Badge variant="secondary" className="ml-1.5 text-xs bg-primary/20">
              {secondaireCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="autres" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
            <Users className="h-4 w-4 mr-1.5" />
            Préscolaire & Primaire
            <Badge variant="secondary" className="ml-1.5 text-xs bg-primary/20">
              {autresCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {['secondaire', 'autres'].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4 space-y-5">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <>
                {/* Dashboard Stats */}
                <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">{dashboardStats.totalEleves}</p>
                          <p className="text-xs text-muted-foreground">Élèves</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                          <span className="text-blue-600 font-bold text-lg">♂</span>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{dashboardStats.garcons}</p>
                          <p className="text-xs text-muted-foreground">Garçons</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-pink-500/15 flex items-center justify-center">
                          <span className="text-pink-600 font-bold text-lg">♀</span>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-pink-600">{dashboardStats.filles}</p>
                          <p className="text-xs text-muted-foreground">Filles</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-accent/15 flex items-center justify-center">
                          <School className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-accent">{dashboardStats.totalClasses}</p>
                          <p className="text-xs text-muted-foreground">Classes</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-secondary/15 flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-secondary">{dashboardStats.totalNiveaux}</p>
                          <p className="text-xs text-muted-foreground">Niveaux</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-emerald-600">{dashboardStats.tauxRemplissage}%</p>
                          <p className="text-xs text-muted-foreground">Remplissage</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Classe la plus remplie */}
                {dashboardStats.classeMax.effectif > 0 && (
                  <div className="flex items-center gap-2 px-1">
                    <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30 text-xs">
                      📊 Classe la plus peuplée : {dashboardStats.classeMax.nom} ({dashboardStats.classeMax.effectif} élèves)
                    </Badge>
                  </div>
                )}

                {structure.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune classe trouvée</CardContent></Card>
                ) : (
                  <Accordion type="multiple">
                    {structure.map(niveau => {
                      const niveauEleves = filteredEleves.filter((e: any) => e.classes?.niveaux?.id === niveau.id);
                      const niveauG = niveauEleves.filter((e: any) => e.sexe === 'M').length;
                      const niveauF = niveauEleves.filter((e: any) => e.sexe === 'F').length;
                      return (
                        <AccordionItem key={niveau.id} value={niveau.id} className="border rounded-lg mb-3 overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 bg-muted/30 hover:bg-muted/50 hover:no-underline">
                            <div className="flex items-center gap-2 flex-wrap">
                              <GraduationCap className="h-5 w-5 text-primary" />
                              <span className="font-semibold">{niveau.nom}</span>
                              <Badge variant="outline">{niveauEleves.length} élèves</Badge>
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">♂ {niveauG}</Badge>
                              <Badge className="bg-pink-100 text-pink-700 border-pink-200 text-xs">♀ {niveauF}</Badge>
                              <span className="text-xs text-muted-foreground">({niveau.classes.length} classes)</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-2">
                            <Accordion type="multiple">
                              {niveau.classes.map((cls: any) => {
                                const stats = getClassStats(cls.id);
                                const capacitePct = cls.capacite ? Math.min(Math.round((stats.total / cls.capacite) * 100), 100) : 0;
                                return (
                                  <AccordionItem key={cls.id} value={cls.id} className="border rounded-md mb-2 overflow-hidden">
                                    <AccordionTrigger className="px-4 py-2.5 hover:bg-muted/30 hover:no-underline">
                                      <div className="flex items-center gap-2 flex-wrap flex-1">
                                        <span className="font-medium">{cls.nom}</span>
                                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{stats.total} élèves</Badge>
                                        <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-xs">♂ {stats.garcons}</Badge>
                                        <Badge className="bg-pink-50 text-pink-600 border-pink-200 text-xs">♀ {stats.filles}</Badge>
                                        {cls.capacite && (
                                          <div className="flex items-center gap-1.5 ml-auto mr-4">
                                            <Progress value={capacitePct} className="h-1.5 w-16" />
                                            <span className="text-xs text-muted-foreground">{stats.total}/{cls.capacite}</span>
                                          </div>
                                        )}
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-muted-foreground">
                                          Effectif : <span className="font-semibold text-foreground">{stats.total}</span>
                                          {' • '}Garçons : <span className="font-semibold text-blue-600">{stats.garcons}</span>
                                          {' • '}Filles : <span className="font-semibold text-pink-600">{stats.filles}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs gap-1.5"
                                            onClick={() => {
                                              const data = getClassEleves(cls.id).map((e: any, i: number) => ({
                                                'N°': i + 1,
                                                'Nom': e.nom,
                                                'Prénom': e.prenom,
                                                'Matricule': e.matricule || '',
                                                'Sexe': e.sexe || '',
                                              }));
                                              const schoolName = schoolConfig?.nom || 'École Internationale Les Enfants du Futur';
                                              exportToExcel(data, `Liste_${cls.nom.replace(/\s+/g, '_')}`, cls.nom, {
                                                schoolName,
                                                niveau: niveau.nom,
                                                classe: cls.nom,
                                                garcons: stats.garcons,
                                                filles: stats.filles,
                                                total: stats.total,
                                              });
                                            }}
                                          >
                                            <Download className="h-3.5 w-3.5" /> Excel
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs gap-1.5"
                                            onClick={() => toggleClassSort(cls.id)}
                                          >
                                            {(classSorts[cls.id] || 'nom') === 'nom' ? (
                                              <><ArrowDownAZ className="h-3.5 w-3.5" /> A→Z</>
                                            ) : (
                                              <><Hash className="h-3.5 w-3.5" /> Matricule</>
                                            )}
                                          </Button>
                                          <div className="relative w-48">
                                            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                              placeholder="Filtrer..."
                                              className="pl-8 h-8 text-sm"
                                              value={classSearches[cls.id] || ''}
                                              onChange={e => setClassSearch(cls.id, e.target.value)}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {(() => {
                                        const classEleves = getClassEleves(cls.id);
                                        if (classEleves.length === 0) {
                                          return (
                                            <p className="text-sm text-muted-foreground py-3 text-center">
                                              {stats.total === 0 ? 'Aucun élève inscrit' : 'Aucun résultat'}
                                            </p>
                                          );
                                        }
                                        return (
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
                                                    <TableCell>
                                                      {eleve.sexe === 'M' ? (
                                                        <span className="text-blue-600">♂</span>
                                                      ) : eleve.sexe === 'F' ? (
                                                        <span className="text-pink-600">♀</span>
                                                      ) : '—'}
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        );
                                      })()}
                                    </AccordionContent>
                                  </AccordionItem>
                                );
                              })}
                            </Accordion>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
