import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, GraduationCap } from 'lucide-react';

interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  sexe: string | null;
  classe_id: string | null;
  statut: string;
  created_at: string;
  classes?: { nom: string; niveaux?: { nom: string; cycles?: { nom: string } } } | null;
}

export default function CoordinateurSecondaireEleves() {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterNiveau, setFilterNiveau] = useState('all');

  useEffect(() => {
    fetchEleves();
  }, []);

  const fetchEleves = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, sexe, classe_id, statut, created_at, classes(nom, niveau_id, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom)))')
      .is('deleted_at', null)
      .order('nom');

    // Filter only secondary cycle students
    const allEleves = (data as any) || [];
    const secondaryEleves = allEleves.filter((e: any) => {
      const cycleName = e.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
      return cycleName.includes('collège') || cycleName.includes('lycée') || cycleName.includes('secondaire');
    });
    setEleves(secondaryEleves);
    setLoading(false);
  };

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    eleves.forEach(e => {
      if (e.classes && e.classe_id) map.set(e.classe_id, (e.classes as any).nom);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [eleves]);

  const niveaux = useMemo(() => {
    const set = new Set<string>();
    eleves.forEach(e => {
      const niveauName = (e.classes as any)?.niveaux?.nom;
      if (niveauName) set.add(niveauName);
    });
    return Array.from(set).sort();
  }, [eleves]);

  const filtered = useMemo(() => {
    return eleves.filter(e => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClasse = filterClasse === 'all' || e.classe_id === filterClasse;
      const niveauName = (e.classes as any)?.niveaux?.nom;
      const matchNiveau = filterNiveau === 'all' || niveauName === filterNiveau;
      return matchSearch && matchClasse && matchNiveau;
    });
  }, [eleves, searchTerm, filterClasse, filterNiveau]);

  const garcons = filtered.filter(e => e.sexe === 'M').length;
  const filles = filtered.filter(e => e.sexe === 'F').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">Élèves du Secondaire</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">Total élèves</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{garcons}</p>
              <p className="text-xs text-muted-foreground">Garçons</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filles}</p>
              <p className="text-xs text-muted-foreground">Filles</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{filtered.length} élève(s) trouvé(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, prénom ou matricule..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterNiveau} onValueChange={setFilterNiveau}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les niveaux</SelectItem>
                {niveaux.map(n => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterClasse} onValueChange={setFilterClasse}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Classe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map(([id, nom]) => (
                  <SelectItem key={id} value={id}>{nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Chargement...</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom & Prénom</TableHead>
                    <TableHead className="hidden sm:table-cell">Matricule</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="hidden sm:table-cell">Niveau</TableHead>
                    <TableHead className="hidden sm:table-cell">Sexe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucun élève trouvé
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(eleve => (
                    <TableRow key={eleve.id}>
                      <TableCell className="font-medium">
                        {eleve.nom} {eleve.prenom}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {eleve.matricule || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{(eleve.classes as any)?.nom || '—'}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {(eleve.classes as any)?.niveaux?.nom || '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={eleve.sexe === 'M' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400'}>
                          {eleve.sexe === 'M' ? 'Garçon' : eleve.sexe === 'F' ? 'Fille' : '—'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
