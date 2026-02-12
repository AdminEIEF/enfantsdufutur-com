import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, AlertTriangle, RefreshCw, UtensilsCrossed, Check, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SEUIL_CANTINE = 1000;

export default function Notifications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  // Existing notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Élèves à réinscrire
  const { data: elevesReinscrire = [] } = useQuery({
    queryKey: ['eleves-a-reinscrire'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, statut, familles(nom_famille, telephone_pere, telephone_mere, email_parent), classes(nom)')
        .eq('statut', 'à réinscrire')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Élèves solde cantine faible
  const { data: elevesCantine = [] } = useQuery({
    queryKey: ['eleves-cantine-faible'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, solde_cantine, option_cantine, familles(nom_famille, telephone_pere, telephone_mere)')
        .eq('option_cantine', true)
        .lt('solde_cantine', SEUIL_CANTINE)
        .order('solde_cantine');
      if (error) throw error;
      return data;
    },
  });

  // Élèves avec retard paiement (inscrits sans paiement scolarité)
  const { data: elevesRetard = [] } = useQuery({
    queryKey: ['eleves-retard-paiement'],
    queryFn: async () => {
      const { data: eleves, error: eErr } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classes(nom, niveaux:niveau_id(frais_scolarite)), familles(nom_famille, telephone_pere, telephone_mere)')
        .eq('statut', 'inscrit');
      if (eErr) throw eErr;

      const { data: paiements, error: pErr } = await supabase
        .from('paiements')
        .select('eleve_id, montant')
        .eq('type_paiement', 'scolarite');
      if (pErr) throw pErr;

      const paiementMap: Record<string, number> = {};
      paiements?.forEach((p: any) => {
        paiementMap[p.eleve_id] = (paiementMap[p.eleve_id] || 0) + Number(p.montant);
      });

      return (eleves || [])
        .map((e: any) => ({
          ...e,
          total_paye: paiementMap[e.id] || 0,
          frais: Number(e.classes?.niveaux?.frais_scolarite || 0),
        }))
        .filter((e: any) => e.frais > 0 && e.total_paye < e.frais)
        .sort((a: any, b: any) => (a.total_paye / a.frais) - (b.total_paye / b.frais));
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ lu: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const generateAlerts = useMutation({
    mutationFn: async (type: string) => {
      setGeneratingType(type);
      let notifs: any[] = [];
      if (type === 'reinscription') {
        notifs = elevesReinscrire.map((e: any) => ({
          titre: `Relance réinscription — ${e.prenom} ${e.nom}`,
          message: `L'élève ${e.prenom} ${e.nom} (${e.matricule || '—'}) est en attente de réinscription. Famille: ${e.familles?.nom_famille || 'Individuel'}. Contact: ${e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}`,
          type: 'reinscription',
          destinataire_type: 'famille',
          destinataire_ref: e.id,
        }));
      } else if (type === 'cantine') {
        notifs = elevesCantine.map((e: any) => ({
          titre: `Solde cantine faible — ${e.prenom} ${e.nom}`,
          message: `Le solde cantine de ${e.prenom} ${e.nom} est de ${Number(e.solde_cantine).toLocaleString()} GNF (seuil: ${SEUIL_CANTINE.toLocaleString()} GNF). Contact: ${e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}`,
          type: 'cantine',
          destinataire_type: 'famille',
          destinataire_ref: e.id,
        }));
      } else if (type === 'paiement') {
        notifs = elevesRetard.map((e: any) => ({
          titre: `Retard de paiement — ${e.prenom} ${e.nom}`,
          message: `${e.prenom} ${e.nom} a payé ${Number(e.total_paye).toLocaleString()} / ${Number(e.frais).toLocaleString()} GNF. Reste: ${(e.frais - e.total_paye).toLocaleString()} GNF. Contact: ${e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}`,
          type: 'paiement',
          destinataire_type: 'famille',
          destinataire_ref: e.id,
        }));
      }
      if (notifs.length === 0) throw new Error('Aucune alerte à générer');
      const { error } = await supabase.from('notifications').insert(notifs);
      if (error) throw error;
      return notifs.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: `${count} notification(s) générée(s)` });
      setGeneratingType(null);
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      setGeneratingType(null);
    },
  });

  const unread = notifications.filter((n: any) => !n.lu).length;
  const typeBadge = (type: string) => {
    if (type === 'reinscription') return <Badge variant="secondary" className="gap-1"><RefreshCw className="h-3 w-3" />Réinscription</Badge>;
    if (type === 'paiement') return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Paiement</Badge>;
    if (type === 'cantine') return <Badge className="gap-1 bg-orange-500"><UtensilsCrossed className="h-3 w-3" />Cantine</Badge>;
    return <Badge variant="outline">{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Bell className="h-7 w-7 text-primary" /> Notifications
        {unread > 0 && <Badge variant="destructive">{unread} non lues</Badge>}
      </h1>

      {/* Alert summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Réinscriptions en attente</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{elevesReinscrire.length}</span>
            <Button size="sm" variant="outline" disabled={elevesReinscrire.length === 0 || generatingType === 'reinscription'} onClick={() => generateAlerts.mutate('reinscription')}>
              {generatingType === 'reinscription' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-1">Relancer</span>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Retards de paiement</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{elevesRetard.length}</span>
            <Button size="sm" variant="outline" disabled={elevesRetard.length === 0 || generatingType === 'paiement'} onClick={() => generateAlerts.mutate('paiement')}>
              {generatingType === 'paiement' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-1">Relancer</span>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" /> Soldes cantine &lt; {SEUIL_CANTINE.toLocaleString()}</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-2xl font-bold">{elevesCantine.length}</span>
            <Button size="sm" variant="outline" disabled={elevesCantine.length === 0 || generatingType === 'cantine'} onClick={() => generateAlerts.mutate('cantine')}>
              {generatingType === 'cantine' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-1">Relancer</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: historique + détails */}
      <Tabs defaultValue="historique">
        <TabsList><TabsTrigger value="historique">Historique</TabsTrigger><TabsTrigger value="reinscription">Réinscriptions</TabsTrigger><TabsTrigger value="paiement">Retards paiement</TabsTrigger><TabsTrigger value="cantine">Cantine</TabsTrigger></TabsList>

        <TabsContent value="historique" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Titre</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                ) : notifications.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune notification</TableCell></TableRow>
                ) : notifications.map((n: any) => (
                  <TableRow key={n.id} className={n.lu ? 'opacity-60' : ''}>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(n.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</TableCell>
                    <TableCell>{typeBadge(n.type)}</TableCell>
                    <TableCell className="max-w-xs truncate">{n.titre}</TableCell>
                    <TableCell>{n.lu ? <Badge variant="outline">Lu</Badge> : <Badge>Non lu</Badge>}</TableCell>
                    <TableCell className="text-right">
                      {!n.lu && <Button size="sm" variant="ghost" onClick={() => markReadMutation.mutate(n.id)}><Check className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reinscription" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead><TableHead>Classe</TableHead><TableHead>Famille</TableHead><TableHead>Contact</TableHead></TableRow></TableHeader>
              <TableBody>
                {elevesReinscrire.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève en attente</TableCell></TableRow>
                ) : elevesReinscrire.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                    <TableCell className="font-medium">{e.nom}</TableCell>
                    <TableCell>{e.prenom}</TableCell>
                    <TableCell>{e.classes?.nom || '—'}</TableCell>
                    <TableCell>{e.familles?.nom_famille || <span className="text-muted-foreground">Individuel</span>}</TableCell>
                    <TableCell className="text-xs">{e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="paiement" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead><TableHead>Classe</TableHead><TableHead>Payé</TableHead><TableHead>Frais</TableHead><TableHead>Reste</TableHead></TableRow></TableHeader>
              <TableBody>
                {elevesRetard.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun retard</TableCell></TableRow>
                ) : elevesRetard.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                    <TableCell className="font-medium">{e.nom}</TableCell>
                    <TableCell>{e.prenom}</TableCell>
                    <TableCell>{e.classes?.nom || '—'}</TableCell>
                    <TableCell>{Number(e.total_paye).toLocaleString()} F</TableCell>
                    <TableCell>{Number(e.frais).toLocaleString()} F</TableCell>
                    <TableCell className="font-semibold text-destructive">{(e.frais - e.total_paye).toLocaleString()} F</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cantine" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead><TableHead>Solde</TableHead><TableHead>Contact</TableHead></TableRow></TableHeader>
              <TableBody>
                {elevesCantine.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun solde critique</TableCell></TableRow>
                ) : elevesCantine.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                    <TableCell className="font-medium">{e.nom}</TableCell>
                    <TableCell>{e.prenom}</TableCell>
                    <TableCell className="font-semibold text-destructive">{Number(e.solde_cantine).toLocaleString()} F</TableCell>
                    <TableCell className="text-xs">{e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
