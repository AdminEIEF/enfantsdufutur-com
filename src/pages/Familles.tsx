import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Search, Phone, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export default function Familles() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFamille, setSelectedFamille] = useState<any>(null);
  const queryClient = useQueryClient();

  const [nomFamille, setNomFamille] = useState('');
  const [telPere, setTelPere] = useState('');
  const [telMere, setTelMere] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');

  const { data: familles = [], isLoading } = useQuery({
    queryKey: ['familles-with-children'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('familles')
        .select('*, eleves(id, nom, prenom, statut, classes(nom))')
        .order('nom_famille');
      if (error) throw error;
      return data;
    },
  });

  const createFamille = useMutation({
    mutationFn: async () => {
      if (!nomFamille.trim()) throw new Error('Le nom de famille est obligatoire');
      const { error } = await supabase.from('familles').insert({
        nom_famille: nomFamille.trim(), telephone_pere: telPere || null,
        telephone_mere: telMere || null, email_parent: email || null, adresse: adresse || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['familles-with-children'] });
      queryClient.invalidateQueries({ queryKey: ['familles'] });
      toast({ title: 'Famille créée', description: `Famille ${nomFamille} ajoutée.` });
      setNomFamille(''); setTelPere(''); setTelMere(''); setEmail(''); setAdresse('');
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const filtered = familles.filter((f: any) =>
    `${f.nom_famille} ${f.email_parent || ''} ${f.telephone_pere || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Familles
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouvelle Famille</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer une famille</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom de famille *</Label><Input value={nomFamille} onChange={e => setNomFamille(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Téléphone père</Label><Input value={telPere} onChange={e => setTelPere(e.target.value)} /></div>
                <div><Label>Téléphone mère</Label><Input value={telMere} onChange={e => setTelMere(e.target.value)} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              <div><Label>Adresse</Label><Input value={adresse} onChange={e => setAdresse(e.target.value)} /></div>
              <Button onClick={() => createFamille.mutate()} disabled={createFamille.isPending} className="w-full">Créer la famille</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher une famille..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <p className="text-muted-foreground col-span-full text-center py-8">Chargement...</p> :
         filtered.length === 0 ? <p className="text-muted-foreground col-span-full text-center py-8">Aucune famille trouvée</p> :
         filtered.map((f: any) => (
          <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedFamille(f)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{f.nom_famille}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {f.telephone_pere && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> Père: {f.telephone_pere}</div>}
              {f.telephone_mere && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> Mère: {f.telephone_mere}</div>}
              {f.email_parent && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> {f.email_parent}</div>}
              <div className="flex gap-1 pt-1">
                <Badge variant="outline">{f.eleves?.length || 0} enfant(s)</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedFamille} onOpenChange={() => setSelectedFamille(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Famille {selectedFamille?.nom_famille}</DialogTitle></DialogHeader>
          {selectedFamille && (
            <div className="space-y-3">
              <div className="text-sm space-y-1">
                {selectedFamille.adresse && <p><strong>Adresse:</strong> {selectedFamille.adresse}</p>}
                {selectedFamille.telephone_pere && <p><strong>Tél. père:</strong> {selectedFamille.telephone_pere}</p>}
                {selectedFamille.telephone_mere && <p><strong>Tél. mère:</strong> {selectedFamille.telephone_mere}</p>}
                {selectedFamille.email_parent && <p><strong>Email:</strong> {selectedFamille.email_parent}</p>}
              </div>
              <h4 className="font-semibold text-sm">Enfants inscrits</h4>
              {selectedFamille.eleves?.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Classe</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {selectedFamille.eleves.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.prenom} {e.nom}</TableCell>
                        <TableCell>{e.classes?.nom || '—'}</TableCell>
                        <TableCell><Badge variant={e.statut === 'inscrit' ? 'default' : 'secondary'}>{e.statut}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-muted-foreground text-sm">Aucun enfant inscrit</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
