import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search, Users, Utensils } from 'lucide-react';

interface Props {
  eleves: any[];
}

export default function CantineInscritsTab({ eleves }: Props) {
  const [search, setSearch] = useState('');

  const inscrits = useMemo(() => {
    return eleves
      .filter((e: any) => e.option_cantine)
      .filter((e: any) =>
        `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
      );
  }, [eleves, search]);

  // Group by niveau then by class
  const grouped = useMemo(() => {
    const map: Record<string, {
      niveauNom: string;
      cycleNom: string;
      classes: Record<string, { classeNom: string; eleves: any[] }>;
    }> = {};

    inscrits.forEach((e: any) => {
      const classeNom = e.classes?.nom || 'Sans classe';
      const niveauNom = e.classes?.niveaux?.nom || 'Sans niveau';
      const cycleNom = e.classes?.niveaux?.cycles?.nom || '';
      const niveauKey = niveauNom;

      if (!map[niveauKey]) {
        map[niveauKey] = { niveauNom, cycleNom, classes: {} };
      }
      if (!map[niveauKey].classes[classeNom]) {
        map[niveauKey].classes[classeNom] = { classeNom, eleves: [] };
      }
      map[niveauKey].classes[classeNom].eleves.push(e);
    });

    // Sort by cycle order
    const cycleOrder = ['Crèche', 'Maternelle', 'Primaire', 'Collège', 'Lycée'];
    return Object.values(map).sort((a, b) => {
      const ai = cycleOrder.indexOf(a.cycleNom);
      const bi = cycleOrder.indexOf(b.cycleNom);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.niveauNom.localeCompare(b.niveauNom);
    });
  }, [inscrits]);

  const totalSolde = inscrits.reduce((s: number, e: any) => s + Number(e.solde_cantine || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total inscrits cantine</p>
              <p className="text-xl font-bold">{inscrits.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Utensils className="h-6 w-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Niveaux concernés</p>
              <p className="text-xl font-bold">{grouped.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">GNF</div>
            <div>
              <p className="text-xs text-muted-foreground">Solde total cantine</p>
              <p className="text-xl font-bold">{totalSolde.toLocaleString()} GNF</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un élève…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Grouped by niveau */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Aucun élève inscrit à la cantine
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={grouped.map(g => g.niveauNom)} className="space-y-2">
          {grouped.map((niveau) => {
            const niveauEleves = Object.values(niveau.classes).flatMap(c => c.eleves);
            const niveauSolde = niveauEleves.reduce((s, e: any) => s + Number(e.solde_cantine || 0), 0);
            const classesList = Object.values(niveau.classes).sort((a, b) => a.classeNom.localeCompare(b.classeNom));

            return (
              <AccordionItem key={niveau.niveauNom} value={niveau.niveauNom} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-3 w-full mr-4">
                    <Badge variant="secondary">{niveau.cycleNom}</Badge>
                    <span className="font-semibold">{niveau.niveauNom}</span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {niveauEleves.length} élève{niveauEleves.length > 1 ? 's' : ''} • Solde : {niveauSolde.toLocaleString()} GNF
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-3">
                  {classesList.map((classe) => (
                    <Card key={classe.classeNom}>
                      <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>{classe.classeNom}</span>
                          <Badge variant="outline">{classe.eleves.length} élève{classe.eleves.length > 1 ? 's' : ''}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Élève</TableHead>
                              <TableHead>Matricule</TableHead>
                              <TableHead className="text-right">Solde Cantine</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {classe.eleves
                              .sort((a: any, b: any) => a.nom.localeCompare(b.nom))
                              .map((e: any) => (
                              <TableRow key={e.id}>
                                <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                                <TableCell className="text-muted-foreground">{e.matricule || '—'}</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={Number(e.solde_cantine || 0) <= 0 ? 'destructive' : 'default'}>
                                    {Number(e.solde_cantine || 0).toLocaleString()} GNF
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
