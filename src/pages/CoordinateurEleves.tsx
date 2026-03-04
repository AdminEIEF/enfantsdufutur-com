import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Users, ChevronDown, ChevronUp, FileText, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

interface CoordDoc {
  id: string;
  type_document: string;
  statut: string;
  date_depot: string | null;
  date_retrait: string | null;
}

interface CoordEleve {
  id: string;
  nom: string;
  prenom: string;
}

export default function CoordinateurEleves() {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterCycle, setFilterCycle] = useState('all');
  const [selectedEleve, setSelectedEleve] = useState<Eleve | null>(null);
  const [coordDocs, setCoordDocs] = useState<CoordDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

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
    setEleves((data as any) || []);
    setLoading(false);
  };

  const fetchDocuments = async (eleve: Eleve) => {
    setSelectedEleve(eleve);
    setLoadingDocs(true);
    // Find matching coordinateur_eleve by name
    const { data: coordEleves } = await supabase
      .from('coordinateur_eleves')
      .select('id')
      .ilike('nom', eleve.nom)
      .ilike('prenom', eleve.prenom)
      .limit(1);

    if (coordEleves && coordEleves.length > 0) {
      const { data: docs } = await supabase
        .from('coordinateur_documents')
        .select('id, type_document, statut, date_depot, date_retrait')
        .eq('eleve_id', coordEleves[0].id);
      setCoordDocs((docs as any) || []);
    } else {
      setCoordDocs([]);
    }
    setLoadingDocs(false);
  };

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    eleves.forEach(e => {
      if (e.classes && e.classe_id) map.set(e.classe_id, (e.classes as any).nom);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [eleves]);

  const cycles = useMemo(() => {
    const set = new Set<string>();
    eleves.forEach(e => {
      const cycleName = (e.classes as any)?.niveaux?.cycles?.nom;
      if (cycleName) set.add(cycleName);
    });
    return Array.from(set).sort();
  }, [eleves]);

  const filtered = useMemo(() => {
    return eleves.filter(e => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClasse = filterClasse === 'all' || e.classe_id === filterClasse;
      const cycleName = (e.classes as any)?.niveaux?.cycles?.nom;
      const matchCycle = filterCycle === 'all' || cycleName === filterCycle;
      return matchSearch && matchClasse && matchCycle;
    });
  }, [eleves, searchTerm, filterClasse, filterCycle]);

  const docStatusBadge = (statut: string) => {
    switch (statut) {
      case 'depose': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Déposé</Badge>;
      case 'rendu': return <Badge variant="destructive">Rendu</Badge>;
      default: return <Badge variant="outline">Non déposé</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">Élèves Maternelle & Primaire</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filtered.length} élève(s) trouvé(s)
          </CardTitle>
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
            <Select value={filterCycle} onValueChange={setFilterCycle}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Cycle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les cycles</SelectItem>
                {cycles.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
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
                    <TableHead className="hidden sm:table-cell">Cycle</TableHead>
                    <TableHead className="text-center">Documents</TableHead>
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
                    <TableRow key={eleve.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchDocuments(eleve)}>
                      <TableCell className="font-medium">
                        {eleve.nom} {eleve.prenom}
                        {eleve.sexe && <span className="text-xs text-muted-foreground ml-1">({eleve.sexe})</span>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {eleve.matricule || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{(eleve.classes as any)?.nom || '—'}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {(eleve.classes as any)?.niveaux?.cycles?.nom || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" className="h-8">
                          <FolderOpen className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Voir</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents Dialog */}
      <Dialog open={!!selectedEleve} onOpenChange={() => setSelectedEleve(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents de {selectedEleve?.prenom} {selectedEleve?.nom}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingDocs ? (
              <p className="text-center py-4 text-muted-foreground">Chargement...</p>
            ) : coordDocs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Aucun document enregistré pour cet élève</p>
                <p className="text-xs mt-1">Les documents sont gérés dans la section "Documents coordinateur"</p>
              </div>
            ) : (
              <div className="space-y-2">
                {coordDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{doc.type_document}</p>
                      {doc.date_depot && (
                        <p className="text-xs text-muted-foreground">
                          Déposé le {format(new Date(doc.date_depot), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      )}
                      {doc.date_retrait && (
                        <p className="text-xs text-muted-foreground">
                          Rendu le {format(new Date(doc.date_retrait), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      )}
                    </div>
                    {docStatusBadge(doc.statut)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
