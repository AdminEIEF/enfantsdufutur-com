import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Bell, AlertTriangle, RefreshCw, UtensilsCrossed, Check, Send, Loader2, MessageSquarePlus, Users, GraduationCap, School, History, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
  const [msgCible, setMsgCible] = useState<string>('ecole');
  const [msgCibleId, setMsgCibleId] = useState<string>('');
  const [msgTitre, setMsgTitre] = useState('');
  const [msgContenu, setMsgContenu] = useState('');
  const [msgType, setMsgType] = useState<string>('info');
  const [msgActionUrl, setMsgActionUrl] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  // Historique des messages envoyés (parent_notifications)
  const { data: sentMessages = [], isLoading: loadingSent } = useQuery({
    queryKey: ['sent-messages-history'],
    queryFn: async () => {
      // Get all parent notifications with famille info
      const { data: parentNotifs, error: pErr } = await supabase
        .from('parent_notifications')
        .select('id, titre, message, type, action_url, lu, created_at, famille_id, familles(nom_famille)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (pErr) throw pErr;

      // Group by titre+message+created_at (within 5 seconds = same batch)
      const groups: Record<string, {
        id: string;
        titre: string;
        message: string;
        type: string;
        action_url: string | null;
        created_at: string;
        destinataires: Array<{ famille_id: string; nom_famille: string; lu: boolean }>;
        total: number;
        lus: number;
      }> = {};

      (parentNotifs || []).forEach((n: any) => {
        // Group key: titre + first 50 chars of message + minute-rounded timestamp
        const timeKey = new Date(n.created_at).toISOString().slice(0, 16); // round to minute
        const key = `${n.titre}||${n.message?.slice(0, 50)}||${timeKey}`;
        if (!groups[key]) {
          groups[key] = {
            id: key,
            titre: n.titre,
            message: n.message,
            type: n.type,
            action_url: n.action_url,
            created_at: n.created_at,
            destinataires: [],
            total: 0,
            lus: 0,
          };
        }
        groups[key].destinataires.push({
          famille_id: n.famille_id,
          nom_famille: n.familles?.nom_famille || 'Inconnue',
          lu: n.lu,
        });
        groups[key].total++;
        if (n.lu) groups[key].lus++;
      });

      return Object.values(groups).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

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

  // Familles pour ciblage
  const { data: familles = [] } = useQuery({
    queryKey: ['familles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('familles').select('id, nom_famille').order('nom_famille');
      return data || [];
    },
  });

  // Classes pour ciblage
  const { data: classes = [] } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, nom, niveaux:niveau_id(nom)').order('nom');
      return data || [];
    },
  });

  // Envoi de message ciblé
  const sendMessage = async () => {
    if (!msgTitre.trim() || !msgContenu.trim()) {
      toast({ title: 'Veuillez remplir le titre et le message', variant: 'destructive' });
      return;
    }
    setSendingMsg(true);
    try {
      let count = 0;
      const actionUrl = msgType === 'action' && msgActionUrl.trim() ? msgActionUrl.trim() : null;

      if (msgCible === 'famille' && msgCibleId) {
        // Une famille spécifique → notif parent
        await supabase.from('parent_notifications').insert({
          famille_id: msgCibleId,
          titre: msgTitre,
          message: msgContenu,
          type: msgType,
          action_url: actionUrl,
        });
        // Aussi pour les élèves de cette famille
        const { data: enfants } = await supabase.from('eleves').select('id').eq('famille_id', msgCibleId).is('deleted_at', null);
        if (enfants && enfants.length > 0) {
          await supabase.from('student_notifications').insert(
            enfants.map((e: any) => ({ eleve_id: e.id, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl }))
          );
        }
        count = 1 + (enfants?.length || 0);
      } else if (msgCible === 'classe' && msgCibleId) {
        // Tous les élèves d'une classe
        const { data: eleves } = await supabase.from('eleves').select('id, famille_id').eq('classe_id', msgCibleId).is('deleted_at', null);
        if (eleves && eleves.length > 0) {
          await supabase.from('student_notifications').insert(
            eleves.map((e: any) => ({ eleve_id: e.id, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl }))
          );
          // Unique families
          const uniqueFamilies = [...new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id))];
          if (uniqueFamilies.length > 0) {
            await supabase.from('parent_notifications').insert(
              uniqueFamilies.map((fid: any) => ({ famille_id: fid, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl }))
            );
          }
          count = eleves.length + uniqueFamilies.length;
        }
      } else if (msgCible === 'ecole') {
        // Toute l'école
        const { data: eleves } = await supabase.from('eleves').select('id, famille_id').is('deleted_at', null);
        if (eleves && eleves.length > 0) {
          // Batch student notifications (max 1000 per insert)
          for (let i = 0; i < eleves.length; i += 500) {
            const batch = eleves.slice(i, i + 500);
            await supabase.from('student_notifications').insert(
              batch.map((e: any) => ({ eleve_id: e.id, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl }))
            );
          }
          const uniqueFamilies = [...new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id))];
          if (uniqueFamilies.length > 0) {
            for (let i = 0; i < uniqueFamilies.length; i += 500) {
              const batch = uniqueFamilies.slice(i, i + 500);
              await supabase.from('parent_notifications').insert(
                batch.map((fid: any) => ({ famille_id: fid, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl }))
              );
            }
          }
          count = eleves.length + uniqueFamilies.length;
        }
      }

      toast({ title: `✅ ${count} notification(s) envoyée(s)` });
      qc.invalidateQueries({ queryKey: ['sent-messages-history'] });
      setMsgTitre('');
      setMsgContenu('');
      setMsgActionUrl('');
      setMsgCibleId('');
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSendingMsg(false);
    }
  };

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
      <Tabs defaultValue="communication">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="communication"><MessageSquarePlus className="h-3.5 w-3.5 mr-1" />Communication</TabsTrigger>
          <TabsTrigger value="messages-envoyes"><History className="h-3.5 w-3.5 mr-1" />Messages envoyés</TabsTrigger>
          <TabsTrigger value="historique">Alertes système</TabsTrigger>
          <TabsTrigger value="reinscription">Réinscriptions</TabsTrigger>
          <TabsTrigger value="paiement">Retards</TabsTrigger>
          <TabsTrigger value="cantine">Cantine</TabsTrigger>
        </TabsList>

        {/* Communication Tab */}
        <TabsContent value="communication" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5" /> Envoyer un message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ciblage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Destinataires</Label>
                  <Select value={msgCible} onValueChange={(v) => { setMsgCible(v); setMsgCibleId(''); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ecole"><div className="flex items-center gap-2"><School className="h-4 w-4" /> Toute l'école</div></SelectItem>
                      <SelectItem value="classe"><div className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Une classe</div></SelectItem>
                      <SelectItem value="famille"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Une famille</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {msgCible === 'classe' && (
                  <div className="space-y-2">
                    <Label>Classe</Label>
                    <Select value={msgCibleId} onValueChange={setMsgCibleId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.nom} — {c.niveaux?.nom}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {msgCible === 'famille' && (
                  <div className="space-y-2">
                    <Label>Famille</Label>
                    <Select value={msgCibleId} onValueChange={setMsgCibleId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une famille" /></SelectTrigger>
                      <SelectContent>
                        {familles.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.nom_famille}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type de message</Label>
                  <Select value={msgType} onValueChange={setMsgType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">ℹ️ Information</SelectItem>
                      <SelectItem value="action">⚡ Action requise</SelectItem>
                      <SelectItem value="alerte">🔔 Alerte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {msgType === 'action' && (
                  <div className="space-y-2">
                    <Label>Lien d'action (URL)</Label>
                    <Input placeholder="https://..." value={msgActionUrl} onChange={e => setMsgActionUrl(e.target.value)} />
                  </div>
                )}
              </div>

              {/* Titre et Message */}
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input placeholder="Ex: Fête de fin d'année" value={msgTitre} onChange={e => setMsgTitre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea placeholder="Contenu du message..." rows={4} value={msgContenu} onChange={e => setMsgContenu(e.target.value)} />
              </div>

              <Button onClick={sendMessage} disabled={sendingMsg || !msgTitre.trim() || !msgContenu.trim() || ((msgCible === 'classe' || msgCible === 'famille') && !msgCibleId)}>
                {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Envoyer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages envoyés Tab */}
        <TabsContent value="messages-envoyes" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5" /> Historique des messages envoyés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="text-center">Destinataires</TableHead>
                    <TableHead className="text-center">Taux de lecture</TableHead>
                    <TableHead className="text-right">Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingSent ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : sentMessages.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun message envoyé</TableCell></TableRow>
                  ) : sentMessages.map((msg: any) => {
                    const readPct = msg.total > 0 ? Math.round((msg.lus / msg.total) * 100) : 0;
                    const isExpanded = expandedMsgId === msg.id;
                    return (
                      <>
                        <TableRow key={msg.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(msg.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </TableCell>
                          <TableCell>{typeBadge(msg.type)}</TableCell>
                          <TableCell className="max-w-xs">
                            <p className="font-medium truncate">{msg.titre}</p>
                            <p className="text-xs text-muted-foreground truncate">{msg.message?.slice(0, 80)}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{msg.total} famille{msg.total > 1 ? 's' : ''}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center gap-2">
                              <Progress value={readPct} className="h-2 flex-1" />
                              <span className="text-xs font-medium whitespace-nowrap">{readPct}%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{msg.lus}/{msg.total} lu{msg.lus > 1 ? 's' : ''}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${msg.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/50 p-4">
                              <div className="space-y-3">
                                <div>
                                  <p className="text-sm font-medium mb-1">Message complet :</p>
                                  <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg border">{msg.message}</p>
                                  {msg.action_url && (
                                    <p className="text-xs mt-1">🔗 Lien : <span className="text-primary">{msg.action_url}</span></p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium mb-2">Destinataires ({msg.total}) :</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                    {msg.destinataires.map((d: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-background border">
                                        {d.lu ? (
                                          <Eye className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                        ) : (
                                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        )}
                                        <span className="truncate">{d.nom_famille}</span>
                                        {d.lu ? (
                                          <Badge variant="outline" className="ml-auto text-[10px] px-1">Lu</Badge>
                                        ) : (
                                          <Badge className="ml-auto text-[10px] px-1">Non lu</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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
