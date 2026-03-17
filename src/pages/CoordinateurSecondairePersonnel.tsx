import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Search, Loader2, Users, Phone, Mail, Download, GraduationCap, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excelUtils';
import AffectationsEnseignants from '@/components/AffectationsEnseignants';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function CoordinateurSecondairePersonnel() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  // Fetch secondary teachers only (matricule starts with ESC)
  const { data: employes = [], isLoading } = useQuery({
    queryKey: ['coord-sec-employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('*, enseignant_classes(id, classe_id, matiere_id, classes(nom, niveaux(nom, cycles(nom))))')
        .eq('categorie', 'enseignant')
        .order('nom');
      if (error) throw error;
      // Filter to secondary only (ESC prefix)
      return (data || []).filter((e: any) => e.matricule?.startsWith('ESC'));
    },
  });

  const filtered = employes.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule} ${e.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  const actifs = filtered.filter((e: any) => e.statut === 'actif');
  const inactifs = filtered.filter((e: any) => e.statut !== 'actif');

  const isAffecte = (emp: any) => emp.enseignant_classes && emp.enseignant_classes.length > 0;

  const handleExportExcel = async () => {
    const data = filtered.map((e: any) => ({
      'Matricule': e.matricule,
      'Nom': e.nom,
      'Prénom': e.prenom,
      'Poste': e.poste || '',
      'Téléphone': e.telephone || '',
      'Email': e.email || '',
      'Statut': e.statut,
    }));
    await exportToExcel(data, 'personnel_secondaire', 'Personnel Secondaire');
    toast({ title: '✅ Export Excel réussi' });
  };

  const renderEmpRow = (e: any) => {
    const affecte = isAffecte(e);
    return (
      <Collapsible key={e.id}>
        <CollapsibleTrigger asChild>
          <TableRow className={`cursor-pointer border-l-4 ${affecte ? 'border-l-emerald-500' : 'border-l-destructive'}`}>
            <TableCell className="font-mono text-xs">{e.matricule}</TableCell>
            <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
            <TableCell className="text-sm">{e.poste || '—'}</TableCell>
            <TableCell>
              {e.statut === 'actif' ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-0">Actif</Badge>
              ) : (
                <Badge variant="secondary">{e.statut}</Badge>
              )}
            </TableCell>
            <TableCell className="text-sm">{e.telephone || '—'}</TableCell>
            <TableCell>
              {affecte ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs">
                  <CircleDot className="h-3 w-3 mr-1" /> Affecté
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-600 border-0 text-xs">Non affecté</Badge>
              )}
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <tr>
            <td colSpan={6} className="p-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email :</span> {e.email || '—'}</div>
                <div><span className="text-muted-foreground">Salaire :</span> {e.prix_heure ? `${e.prix_heure} GNF/h` : `${e.salaire_base?.toLocaleString()} GNF`}</div>
                {e.enseignant_classes?.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Classes :</span>{' '}
                    {e.enseignant_classes.map((ec: any) => ec.classes?.nom).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </td>
          </tr>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Enseignants — Secondaire
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestion du personnel enseignant du cycle secondaire</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{employes.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{actifs.length}</p>
          <p className="text-xs text-muted-foreground">Actifs</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{employes.filter(isAffecte).length}</p>
          <p className="text-xs text-muted-foreground">Affectés</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{employes.filter((e: any) => !isAffecte(e)).length}</p>
          <p className="text-xs text-muted-foreground">Non affectés</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="affectations">Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="liste">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" /> Export Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Aucun enseignant secondaire trouvé.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom & Prénom</TableHead>
                        <TableHead>Poste</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Affectation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(renderEmpRow)}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affectations">
          <AffectationsEnseignants />
        </TabsContent>
      </Tabs>
    </div>
  );
}
