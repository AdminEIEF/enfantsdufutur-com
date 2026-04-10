import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Bell, AlertTriangle, RefreshCw, UtensilsCrossed, Check, Send, Loader2, MessageSquarePlus, Users, GraduationCap, School, History, Eye, EyeOff, ChevronDown, ChevronUp, Megaphone, TrendingDown, CreditCard } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { sortClasses } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const SEUIL_CANTINE = 1000;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

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

  // Historique des messages envoyés
  const { data: sentMessages = [], isLoading: loadingSent } = useQuery({
    queryKey: ['sent-messages-history'],
    queryFn: async () => {
      const { data: parentNotifs, error: pErr } = await supabase
        .from('parent_notifications')
        .select('id, titre, message, type, action_url, lu, created_at, famille_id, familles(nom_famille)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (pErr) throw pErr;

      const groups: Record<string, any> = {};
      (parentNotifs || []).forEach((n: any) => {
        const timeKey = new Date(n.created_at).toISOString().slice(0, 16);
        const key = `${n.titre}||${n.message?.slice(0, 50)}||${timeKey}`;
        if (!groups[key]) {
          groups[key] = { id: key, titre: n.titre, message: n.message, type: n.type, action_url: n.action_url, created_at: n.created_at, destinataires: [], total: 0, lus: 0 };
        }
        groups[key].destinataires.push({ famille_id: n.famille_id, nom_famille: n.familles?.nom_famille || 'Inconnue', lu: n.lu });
        groups[key].total++;
        if (n.lu) groups[key].lus++;
      });

      return Object.values(groups).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: elevesReinscrire = [] } = useQuery({
    queryKey: ['eleves-a-reinscrire'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, statut, familles(nom_famille, telephone_pere, telephone_mere, email_parent), classes(nom)').eq('statut', 'à réinscrire').is('deleted_at', null).order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: elevesCantine = [] } = useQuery({
    queryKey: ['eleves-cantine-faible'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule, solde_cantine, option_cantine, familles(nom_famille, telephone_pere, telephone_mere)').eq('option_cantine', true).lt('solde_cantine', SEUIL_CANTINE).order('solde_cantine');
      if (error) throw error;
      return data;
    },
  });

  const { data: elevesRetard = [] } = useQuery({
    queryKey: ['eleves-retard-paiement'],
    queryFn: async () => {
      const { data: eleves, error: eErr } = await supabase.from('eleves').select('id, nom, prenom, matricule, classes(nom, niveaux:niveau_id(frais_scolarite)), familles(nom_famille, telephone_pere, telephone_mere)').eq('statut', 'inscrit');
      if (eErr) throw eErr;
      const { data: paiements, error: pErr } = await supabase.from('paiements').select('eleve_id, montant').eq('type_paiement', 'scolarite');
      if (pErr) throw pErr;
      const paiementMap: Record<string, number> = {};
      paiements?.forEach((p: any) => { paiementMap[p.eleve_id] = (paiementMap[p.eleve_id] || 0) + Number(p.montant); });
      return (eleves || []).map((e: any) => ({ ...e, total_paye: paiementMap[e.id] || 0, frais: Number(e.classes?.niveaux?.frais_scolarite || 0) })).filter((e: any) => e.frais > 0 && e.total_paye < e.frais).sort((a: any, b: any) => (a.total_paye / a.frais) - (b.total_paye / b.frais));
    },
  });

  const { data: familles = [] } = useQuery({
    queryKey: ['familles-list'],
    queryFn: async () => { const { data } = await supabase.from('familles').select('id, nom_famille').order('nom_famille'); return data || []; },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => { const { data } = await supabase.from('classes').select('id, nom, niveaux:niveau_id(nom, ordre, cycles:cycle_id(ordre))'); return sortClasses(data || []); },
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
        await supabase.from('parent_notifications').insert({ famille_id: msgCibleId, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl });
        const { data: enfants } = await supabase.from('eleves').select('id').eq('famille_id', msgCibleId).is('deleted_at', null);
        if (enfants && enfants.length > 0) {
          await supabase.from('student_notifications').insert(enfants.map((e: any) => ({ eleve_id: e.id, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl })));
        }
        count = 1 + (enfants?.length || 0);
      } else if (msgCible === 'classe' && msgCibleId) {
        const { data: eleves } = await supabase.from('eleves').select('id, famille_id').eq('classe_id', msgCibleId).is('deleted_at', null);
        if (eleves && eleves.length > 0) {
          await supabase.from('student_notifications').insert(eleves.map((e: any) => ({ eleve_id: e.id, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl })));
          const uniqueFamilies = [...new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id))];
          if (uniqueFamilies.length > 0) {
            await supabase.from('parent_notifications').insert(uniqueFamilies.map((fid: any) => ({ famille_id: fid, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl })));
          }
          count = eleves.length + uniqueFamilies.length;
        }
      } else if (msgCible === 'ecole') {
        const { data: eleves } = await supabase.from('eleves').select('id, famille_id').is('deleted_at', null);
        if (eleves && eleves.length > 0) {
          for (let i = 0; i < eleves.length; i += 500) {
            const batch = eleves.slice(i, i + 500);
            await supabase.from('student_notifications').insert(batch.map((e: any) => ({ eleve_id: e.id, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl })));
          }
          const uniqueFamilies = [...new Set(eleves.filter((e: any) => e.famille_id).map((e: any) => e.famille_id))];
          if (uniqueFamilies.length > 0) {
            for (let i = 0; i < uniqueFamilies.length; i += 500) {
              const batch = uniqueFamilies.slice(i, i + 500);
              await supabase.from('parent_notifications').insert(batch.map((fid: any) => ({ famille_id: fid, titre: msgTitre, message: msgContenu, type: msgType, action_url: actionUrl })));
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
        notifs = elevesReinscrire.map((e: any) => ({ titre: `Relance réinscription — ${e.prenom} ${e.nom}`, message: `L'élève ${e.prenom} ${e.nom} (${e.matricule || '—'}) est en attente de réinscription. Famille: ${e.familles?.nom_famille || 'Individuel'}. Contact: ${e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}`, type: 'reinscription', destinataire_type: 'famille', destinataire_ref: e.id }));
      } else if (type === 'cantine') {
        notifs = elevesCantine.map((e: any) => ({ titre: `Solde cantine faible — ${e.prenom} ${e.nom}`, message: `Le solde cantine de ${e.prenom} ${e.nom} est de ${Number(e.solde_cantine).toLocaleString()} GNF (seuil: ${SEUIL_CANTINE.toLocaleString()} GNF). Contact: ${e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}`, type: 'cantine', destinataire_type: 'famille', destinataire_ref: e.id }));
      } else if (type === 'paiement') {
        notifs = elevesRetard.map((e: any) => ({ titre: `Retard de paiement — ${e.prenom} ${e.nom}`, message: `${e.prenom} ${e.nom} a payé ${Number(e.total_paye).toLocaleString()} / ${Number(e.frais).toLocaleString()} GNF. Reste: ${(e.frais - e.total_paye).toLocaleString()} GNF. Contact: ${e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}`, type: 'paiement', destinataire_type: 'famille', destinataire_ref: e.id }));
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

  const typeBadgeModern = (type: string) => {
    const styles: Record<string, string> = {
      reinscription: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
      paiement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      cantine: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      action: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      alerte: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    };
    const icons: Record<string, any> = {
      reinscription: <RefreshCw className="h-3 w-3" />,
      paiement: <CreditCard className="h-3 w-3" />,
      cantine: <UtensilsCrossed className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${styles[type] || styles.info}`}>
        {icons[type]} {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const alertCards = [
    {
      title: 'Réinscriptions en attente',
      count: elevesReinscrire.length,
      icon: RefreshCw,
      color: 'from-violet-500 to-purple-600',
      bgLight: 'bg-violet-50 dark:bg-violet-950/20',
      iconBg: 'bg-violet-500/10',
      iconColor: 'text-violet-600 dark:text-violet-400',
      type: 'reinscription',
    },
    {
      title: 'Retards de paiement',
      count: elevesRetard.length,
      icon: TrendingDown,
      color: 'from-red-500 to-rose-600',
      bgLight: 'bg-red-50 dark:bg-red-950/20',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-600 dark:text-red-400',
      type: 'paiement',
    },
    {
      title: `Soldes cantine < ${SEUIL_CANTINE.toLocaleString()}`,
      count: elevesCantine.length,
      icon: UtensilsCrossed,
      color: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 dark:bg-amber-950/20',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      type: 'cantine',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Bell className="h-5.5 w-5.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notifications</h1>
            <p className="text-xs text-muted-foreground">Centre de communication & alertes</p>
          </div>
        </div>
        {unread > 0 && (
          <Badge variant="destructive" className="rounded-full px-3 py-1 text-xs font-bold animate-pulse">
            {unread} non lue{unread > 1 ? 's' : ''}
          </Badge>
        )}
      </motion.div>

      {/* Alert summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {alertCards.map((card, i) => (
          <motion.div key={card.type} custom={i} initial="hidden" animate="visible" variants={fadeUp}>
            <Card className={`${card.bgLight} border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <div className={`h-10 w-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                      <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-foreground">{card.count}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.title}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs h-8 gap-1.5 border-border/50 hover:bg-background"
                    disabled={card.count === 0 || generatingType === card.type}
                    onClick={() => generateAlerts.mutate(card.type)}
                  >
                    {generatingType === card.type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Relancer
                  </Button>
                </div>
                {/* Decorative gradient bar */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${card.color}`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="communication">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="communication" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> Communication
          </TabsTrigger>
          <TabsTrigger value="messages-envoyes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs gap-1.5">
            <History className="h-3.5 w-3.5" /> Messages envoyés
          </TabsTrigger>
          <TabsTrigger value="historique" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Alertes système
          </TabsTrigger>
          <TabsTrigger value="reinscription" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Réinscriptions
          </TabsTrigger>
          <TabsTrigger value="paiement" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Retards
          </TabsTrigger>
          <TabsTrigger value="cantine" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Cantine
          </TabsTrigger>
        </TabsList>

        {/* Communication Tab */}
        <TabsContent value="communication" className="mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageSquarePlus className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Envoyer un message</h3>
                    <p className="text-[11px] text-muted-foreground">Communiquer avec les familles et élèves</p>
                  </div>
                </div>

                {/* Ciblage */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Destinataires</Label>
                    <Select value={msgCible} onValueChange={(v) => { setMsgCible(v); setMsgCibleId(''); }}>
                      <SelectTrigger className="rounded-xl h-10">
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
                      <Label className="text-xs font-medium">Classe</Label>
                      <Select value={msgCibleId} onValueChange={setMsgCibleId}>
                        <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
                        <SelectContent>
                          {classes.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.nom} — {c.niveaux?.nom}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {msgCible === 'famille' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Famille</Label>
                      <Select value={msgCibleId} onValueChange={setMsgCibleId}>
                        <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Sélectionner une famille" /></SelectTrigger>
                        <SelectContent>
                          {familles.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nom_famille}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Type de message</Label>
                    <Select value={msgType} onValueChange={setMsgType}>
                      <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">ℹ️ Information</SelectItem>
                        <SelectItem value="action">⚡ Action requise</SelectItem>
                        <SelectItem value="alerte">🔔 Alerte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {msgType === 'action' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Lien d'action (URL)</Label>
                      <Input placeholder="https://..." className="rounded-xl h-10" value={msgActionUrl} onChange={e => setMsgActionUrl(e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Titre et Message */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Titre</Label>
                  <Input placeholder="Ex: Fête de fin d'année" className="rounded-xl h-10" value={msgTitre} onChange={e => setMsgTitre(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Message</Label>
                  <Textarea placeholder="Contenu du message..." rows={4} className="rounded-xl resize-none" value={msgContenu} onChange={e => setMsgContenu(e.target.value)} />
                </div>

                <Button
                  onClick={sendMessage}
                  disabled={sendingMsg || !msgTitre.trim() || !msgContenu.trim() || ((msgCible === 'classe' || msgCible === 'famille') && !msgCibleId)}
                  className="rounded-xl h-10 gap-2 px-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md shadow-primary/20"
                >
                  {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer le message
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Messages envoyés Tab */}
        <TabsContent value="messages-envoyes" className="mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border/30 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <History className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Historique des messages</h3>
                  <p className="text-[11px] text-muted-foreground">{sentMessages.length} message{sentMessages.length > 1 ? 's' : ''} envoyé{sentMessages.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="divide-y divide-border/30">
                {loadingSent ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : sentMessages.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">Aucun message envoyé</div>
                ) : sentMessages.map((msg: any) => {
                  const readPct = msg.total > 0 ? Math.round((msg.lus / msg.total) * 100) : 0;
                  const isExpanded = expandedMsgId === msg.id;
                  return (
                    <div key={msg.id}>
                      <button
                        className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {typeBadgeModern(msg.type)}
                              <span className="text-[11px] text-muted-foreground">
                                {format(new Date(msg.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                              </span>
                            </div>
                            <p className="text-sm font-semibold mt-2 truncate text-foreground">{msg.titre}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{msg.message?.slice(0, 120)}</p>
                          </div>
                          <div className="shrink-0 text-right space-y-1.5 min-w-[120px]">
                            <Badge variant="secondary" className="rounded-full text-[10px]">
                              {msg.total} famille{msg.total > 1 ? 's' : ''}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Progress value={readPct} className="h-1.5 flex-1" />
                              <span className="text-[10px] font-semibold text-muted-foreground">{readPct}%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{msg.lus}/{msg.total} lu{msg.lus > 1 ? 's' : ''}</p>
                          </div>
                          <div className="shrink-0 mt-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden">
                          <div className="px-5 py-4 bg-muted/20 border-t border-border/20 space-y-4">
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-1.5">Message complet</p>
                              <p className="text-sm text-muted-foreground bg-background p-3.5 rounded-xl border border-border/30 leading-relaxed">{msg.message}</p>
                              {msg.action_url && (
                                <p className="text-xs mt-1.5">🔗 <span className="text-primary underline">{msg.action_url}</span></p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-2">Destinataires ({msg.total})</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {msg.destinataires.map((d: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs p-2.5 rounded-xl bg-background border border-border/30">
                                    {d.lu ? <Eye className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                    <span className="truncate flex-1">{d.nom_famille}</span>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${d.lu ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                                      {d.lu ? 'Lu' : 'Non lu'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Alertes système */}
        <TabsContent value="historique" className="mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm overflow-hidden">
              <div className="divide-y divide-border/30">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">Aucune notification</div>
                ) : notifications.map((n: any) => (
                  <div key={n.id} className={`px-5 py-4 flex items-start gap-3 transition-colors ${!n.lu ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                    <div className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${!n.lu ? 'bg-primary/10' : 'bg-muted/50'}`}>
                      {n.type === 'reinscription' ? <RefreshCw className="h-4 w-4 text-violet-600" /> :
                       n.type === 'paiement' ? <CreditCard className="h-4 w-4 text-red-600" /> :
                       n.type === 'cantine' ? <UtensilsCrossed className="h-4 w-4 text-amber-600" /> :
                       <Bell className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!n.lu ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{n.titre}</p>
                        {typeBadgeModern(n.type)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        {format(new Date(n.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {!n.lu ? (
                        <Button size="sm" variant="ghost" className="rounded-xl h-8 text-xs gap-1" onClick={() => markReadMutation.mutate(n.id)}>
                          <Check className="h-3.5 w-3.5" /> Marquer lu
                        </Button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full">Lu</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Réinscriptions */}
        <TabsContent value="reinscription" className="mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs">Prénom</TableHead>
                      <TableHead className="text-xs">Classe</TableHead>
                      <TableHead className="text-xs">Famille</TableHead>
                      <TableHead className="text-xs">Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elevesReinscrire.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Aucun élève en attente</TableCell></TableRow>
                    ) : elevesReinscrire.map((e: any) => (
                      <TableRow key={e.id} className="border-border/20">
                        <TableCell className="font-mono text-xs text-muted-foreground">{e.matricule || '—'}</TableCell>
                        <TableCell className="font-medium text-sm">{e.nom}</TableCell>
                        <TableCell className="text-sm">{e.prenom}</TableCell>
                        <TableCell className="text-sm">{e.classes?.nom || '—'}</TableCell>
                        <TableCell className="text-sm">{e.familles?.nom_famille || <span className="text-muted-foreground">Individuel</span>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Retards */}
        <TabsContent value="paiement" className="mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs">Prénom</TableHead>
                      <TableHead className="text-xs">Classe</TableHead>
                      <TableHead className="text-xs">Payé</TableHead>
                      <TableHead className="text-xs">Frais</TableHead>
                      <TableHead className="text-xs">Reste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elevesRetard.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Aucun retard</TableCell></TableRow>
                    ) : elevesRetard.map((e: any) => (
                      <TableRow key={e.id} className="border-border/20">
                        <TableCell className="font-mono text-xs text-muted-foreground">{e.matricule || '—'}</TableCell>
                        <TableCell className="font-medium text-sm">{e.nom}</TableCell>
                        <TableCell className="text-sm">{e.prenom}</TableCell>
                        <TableCell className="text-sm">{e.classes?.nom || '—'}</TableCell>
                        <TableCell className="text-sm">{Number(e.total_paye).toLocaleString()} F</TableCell>
                        <TableCell className="text-sm">{Number(e.frais).toLocaleString()} F</TableCell>
                        <TableCell className="font-semibold text-sm text-destructive">{(e.frais - e.total_paye).toLocaleString()} F</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Cantine */}
        <TabsContent value="cantine" className="mt-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30">
                      <TableHead className="text-xs">Matricule</TableHead>
                      <TableHead className="text-xs">Nom</TableHead>
                      <TableHead className="text-xs">Prénom</TableHead>
                      <TableHead className="text-xs">Solde</TableHead>
                      <TableHead className="text-xs">Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elevesCantine.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">Aucun solde critique</TableCell></TableRow>
                    ) : elevesCantine.map((e: any) => (
                      <TableRow key={e.id} className="border-border/20">
                        <TableCell className="font-mono text-xs text-muted-foreground">{e.matricule || '—'}</TableCell>
                        <TableCell className="font-medium text-sm">{e.nom}</TableCell>
                        <TableCell className="text-sm">{e.prenom}</TableCell>
                        <TableCell className="font-semibold text-sm text-destructive">{Number(e.solde_cantine).toLocaleString()} F</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.familles?.telephone_pere || e.familles?.telephone_mere || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
