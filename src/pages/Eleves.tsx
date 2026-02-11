import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Eleves() {
  const [search, setSearch] = useState('');
  const [filterCycle, setFilterCycle] = useState('all');
  const [selected, setSelected] = useState<any>(null);

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['eleves-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom, niveau_id, niveaux:niveau_id(nom, frais_scolarite, cycle_id, cycles:cycle_id(nom, id))), familles(nom_famille, telephone_pere, telephone_mere, email_parent)')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const filtered = eleves.filter((e: any) => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchCycle = filterCycle === 'all' || e.classes?.niveaux?.cycles?.id === filterCycle;
    return matchSearch && matchCycle;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-7 w-7 text-primary" /> Élèves
      </h1>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCycle} onValueChange={setFilterCycle}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les cycles</SelectItem>
            {cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead>
                <TableHead>Sexe</TableHead><TableHead>Cycle</TableHead><TableHead>Classe</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setSelected(e)}>
                  <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                  <TableCell className="font-medium">{e.nom}</TableCell>
                  <TableCell>{e.prenom}</TableCell>
                  <TableCell>{e.sexe || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{e.classes?.niveaux?.cycles?.nom || '—'}</Badge></TableCell>
                  <TableCell>{e.classes?.nom || '—'}</TableCell>
                  <TableCell><Badge variant={e.statut === 'inscrit' ? 'default' : 'secondary'}>{e.statut}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {selected?.prenom} {selected?.nom}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Matricule:</strong> {selected.matricule || '—'}</div>
                <div><strong>Sexe:</strong> {selected.sexe || '—'}</div>
                <div><strong>Date de naissance:</strong> {selected.date_naissance || '—'}</div>
                <div><strong>Statut:</strong> <Badge>{selected.statut}</Badge></div>
                <div><strong>Cycle:</strong> {selected.classes?.niveaux?.cycles?.nom || '—'}</div>
                <div><strong>Classe:</strong> {selected.classes?.nom || '—'}</div>
              </div>
              {selected.familles && (
                <div>
                  <h4 className="font-semibold mb-1">Famille: {selected.familles.nom_famille}</h4>
                  <div className="text-muted-foreground space-y-1">
                    {selected.familles.telephone_pere && <p>Tél. père: {selected.familles.telephone_pere}</p>}
                    {selected.familles.telephone_mere && <p>Tél. mère: {selected.familles.telephone_mere}</p>}
                    {selected.familles.email_parent && <p>Email: {selected.familles.email_parent}</p>}
                  </div>
                </div>
              )}
              <div>
                <h4 className="font-semibold mb-1">Check-list</h4>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={selected.checklist_livret ? 'default' : 'outline'}>Livret {selected.checklist_livret ? '✓' : '✗'}</Badge>
                  <Badge variant={selected.checklist_rames ? 'default' : 'outline'}>Rames {selected.checklist_rames ? '✓' : '✗'}</Badge>
                  <Badge variant={selected.checklist_marqueurs ? 'default' : 'outline'}>Marqueurs {selected.checklist_marqueurs ? '✓' : '✗'}</Badge>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Options</h4>
                <div className="flex gap-2 flex-wrap">
                  {selected.transport_zone && <Badge variant="outline">Transport: {selected.transport_zone}</Badge>}
                  {selected.option_cantine && <Badge variant="outline">Cantine</Badge>}
                  {selected.uniforme_scolaire && <Badge variant="outline">Uniforme scolaire</Badge>}
                  {selected.uniforme_sport && <Badge variant="outline">Uniforme sport</Badge>}
                  {selected.uniforme_polo_lacoste && <Badge variant="outline">Polo Lacoste</Badge>}
                  {selected.uniforme_karate && <Badge variant="outline">Karaté</Badge>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="text-sm text-muted-foreground">{filtered.length} élève(s) trouvé(s)</div>
    </div>
  );
}
