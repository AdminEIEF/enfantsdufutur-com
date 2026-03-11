import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Corbeille() {
  const qc = useQueryClient();

  const { data: deleted = [], isLoading } = useQuery({
    queryKey: ['eleves-corbeille'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eleves').update({ deleted_at: null } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-corbeille'] });
      qc.invalidateQueries({ queryKey: ['eleves-full'] });
      toast.success('Élève restauré avec succès');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePermanently = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eleves').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-corbeille'] });
      toast.success('Élève supprimé définitivement');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Corbeille</h1>
        <p className="text-muted-foreground text-sm">Élèves supprimés — restauration ou suppression définitive</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" /> Corbeille ({deleted.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Supprimé le</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : deleted.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">La corbeille est vide</TableCell></TableRow>
              ) : deleted.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                  <TableCell className="font-medium">{e.nom}</TableCell>
                  <TableCell>{e.prenom}</TableCell>
                  <TableCell>{e.classes?.nom || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(e.deleted_at).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => restore.mutate(e.id)} title="Restaurer">
                        <RotateCcw className="h-4 w-4 mr-1" /> Restaurer
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Supprimer définitivement">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'élève {e.prenom} {e.nom} sera supprimé définitivement.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePermanently.mutate(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Supprimer définitivement
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
