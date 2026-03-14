import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export default function TresorierAvances() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refuseTarget, setRefuseTarget] = useState<string | null>(null);
  const [refuseMotif, setRefuseMotif] = useState('');

  const { data: avancesEnAttente = [], isLoading: loadingAttente } = useQuery({
    queryKey: ['avances-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allAvances = [], isLoading: loadingAll } = useQuery({
    queryKey: ['all-avances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleAvance = async (id: string, statut: 'approuve' | 'refuse', motif?: string) => {
    const avance = avancesEnAttente.find((a: any) => a.id === id);
    await supabase.from('avances_salaire').update({
      statut,
      motif: statut === 'refuse' && motif ? motif : undefined,
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    }).eq('id', id);

    if (avance?.employe_id) {
      await supabase.from('employee_notifications').insert({
        employe_id: avance.employe_id,
        titre: statut === 'approuve' ? '✅ Avance approuvée' : '❌ Avance refusée',
        message: statut === 'approuve'
          ? `Votre demande d'avance de ${Number(avance.montant).toLocaleString()} GNF a été approuvée. Elle sera déduite de votre prochain bulletin de paie.`
          : `Votre demande d'avance de ${Number(avance.montant).toLocaleString()} GNF a été refusée.${motif ? ' Motif: ' + motif : ''}`,
        type: statut === 'approuve' ? 'info' : 'alerte',
      });
    }
    toast({ title: statut === 'approuve' ? '✅ Avance approuvée' : '❌ Avance refusée' });
    qc.invalidateQueries({ queryKey: ['avances-attente'] });
    qc.invalidateQueries({ queryKey: ['all-avances'] });
  };

  const confirmRefuse = async () => {
    if (refuseTarget) {
      await handleAvance(refuseTarget, 'refuse', refuseMotif);
      setRefuseTarget(null);
      setRefuseMotif('');
    }
  };

  const totalEnCours = allAvances
    .filter((a: any) => a.statut === 'approuve')
    .reduce((s: number, a: any) => s + (Number(a.montant) - Number(a.montant_rembourse || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Avances</h1>
          <p className="text-sm text-muted-foreground">Approuver, refuser et suivre les avances sur salaire</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <div className="text-xl font-bold">{avancesEnAttente.length}</div>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Check className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-xl font-bold">{allAvances.filter((a: any) => a.statut === 'approuve').length}</div>
            <p className="text-xs text-muted-foreground">Approuvées en cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-xl font-bold">{totalEnCours.toLocaleString()} GNF</div>
            <p className="text-xs text-muted-foreground">Montant restant à rembourser</p>
          </CardContent>
        </Card>
      </div>

      {/* Demandes en attente */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Demandes d'avance en attente</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAttente ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : avancesEnAttente.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune demande en attente</TableCell></TableRow>
              ) : avancesEnAttente.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                  <TableCell className="font-mono text-xs">{a.employes?.matricule}</TableCell>
                  <TableCell className="font-bold">{Number(a.montant).toLocaleString()} GNF</TableCell>
                  <TableCell className="text-sm max-w-40 truncate">{a.motif || '—'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleAvance(a.id, 'approuve')}>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setRefuseTarget(a.id); setRefuseMotif(''); }}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Suivi des avances approuvées */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Suivi des avances approuvées</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Remboursé</TableHead>
                <TableHead>Restant</TableHead>
                <TableHead>Mois déduction</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allAvances.filter((a: any) => a.statut === 'approuve' || a.statut === 'rembourse').length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune avance approuvée</TableCell></TableRow>
              ) : allAvances.filter((a: any) => a.statut === 'approuve' || a.statut === 'rembourse').map((a: any) => {
                const restant = Number(a.montant) - Number(a.montant_rembourse);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                    <TableCell>{Number(a.montant).toLocaleString()} GNF</TableCell>
                    <TableCell className="text-emerald-600">{Number(a.montant_rembourse).toLocaleString()} GNF</TableCell>
                    <TableCell className={`font-bold ${restant > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{restant.toLocaleString()} GNF</TableCell>
                    <TableCell className="text-sm">{a.mois_remboursement || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.statut === 'rembourse' ? 'default' : 'secondary'}>
                        {a.statut === 'rembourse' ? 'Remboursé' : 'En cours'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Historique refusées */}
      {allAvances.filter((a: any) => a.statut === 'refuse').length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Avances refusées</CardTitle></CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAvances.filter((a: any) => a.statut === 'refuse').map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                    <TableCell>{Number(a.montant).toLocaleString()} GNF</TableCell>
                    <TableCell className="text-sm">{a.motif || '—'}</TableCell>
                    <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Refuse dialog */}
      <Dialog open={!!refuseTarget} onOpenChange={() => setRefuseTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <Textarea value={refuseMotif} onChange={e => setRefuseMotif(e.target.value)} placeholder="Motif du refus (optionnel)..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmRefuse}>Refuser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
