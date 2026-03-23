import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CalendarPlus, History, RefreshCcw, Play, Archive, CheckCircle, AlertTriangle, Users, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Promotion mapping: class prefix -> next class prefix
const PROMOTION_MAP: Record<string, string> = {
  'TPS': 'CRECHE',
  'CRECHE': 'PS',
  'PS': 'MS',
  'MS': 'GS-CP1',
  'GS-CP1': 'CP2',
  'CP2': 'CE1',
  'CE1': 'CE2',
  'CE2': 'CM1',
  'CM1': 'CM2',
  'CM2': '7E',
  '7E': '8E',
  '8E': '9E',
  '9E': '10E',
  '10E': '11E',
  '11E': '12E',
  '12E': 'TSE', // Terminal
};

function getClassPrefix(nom: string) {
  // Extract prefix like "CE1", "7E", "CM2", "GS-CP1", "TSE" etc.
  const cleaned = nom.trim().toUpperCase();
  // Match patterns like "CE1", "7E", "GS-CP1", "PS", "MS", "TPS", "CRECHE", "TSE", "TSM", "TSS", "11E", "12E"
  const match = cleaned.match(/^(GS-CP1|TPS|CRECHE|PS|MS|CP2|CE1|CE2|CM1|CM2|7E|8E|9E|10E|11E|12E|TS[EMS])/i);
  return match ? match[1] : null;
}

export default function GestionSessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('sessions');
  const [newNom, setNewNom] = useState('');
  const [newDebut, setNewDebut] = useState('');
  const [newFin, setNewFin] = useState('');
  const [archiveSession, setArchiveSession] = useState('');
  const [redoublants, setRedoublants] = useState<Set<string>>(new Set());
  const [promotionSessionId, setPromotionSessionId] = useState('');

  // Fetch sessions
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['sessions-scolaires'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions_scolaires')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch classes with niveaux
  const { data: classes = [] } = useQuery({
    queryKey: ['classes-promotion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom, niveau_id, niveaux!classes_niveau_id_fkey(nom, cycle_id, cycles:cycle_id(nom, ordre))')
        .order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch eleves for promotion
  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves-promotion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, classe_id, matricule, classes(nom)')
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch archives
  const { data: archives = [] } = useQuery({
    queryKey: ['paiements-archive', archiveSession],
    queryFn: async () => {
      if (!archiveSession) return [];
      const { data, error } = await supabase
        .from('paiements_archive')
        .select('*')
        .eq('session_id', archiveSession)
        .order('date_paiement', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!archiveSession,
  });

  // Fetch promotions log
  const { data: promotionLogs = [] } = useQuery({
    queryKey: ['promotions-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions_log')
        .select('*, sessions_scolaires(nom)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const activeSession = sessions.find((s: any) => s.active);

  // Create session
  const createSession = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sessions_scolaires').insert({
        nom: newNom,
        date_debut: newDebut,
        date_fin: newFin,
        active: false,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Session créée avec succès');
      setNewNom('');
      setNewDebut('');
      setNewFin('');
      queryClient.invalidateQueries({ queryKey: ['sessions-scolaires'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Activate session
  const activateSession = useMutation({
    mutationFn: async (sessionId: string) => {
      // Deactivate all first
      const { error: err1 } = await supabase
        .from('sessions_scolaires')
        .update({ active: false })
        .eq('active', true);
      if (err1) throw err1;
      // Activate selected
      const { error: err2 } = await supabase
        .from('sessions_scolaires')
        .update({ active: true })
        .eq('id', sessionId);
      if (err2) throw err2;
    },
    onSuccess: () => {
      toast.success('Session activée');
      queryClient.invalidateQueries({ queryKey: ['sessions-scolaires'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Close session & archive
  const closeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      // Archive paiements
      const { data: paiements, error: pErr } = await supabase
        .from('paiements')
        .select('id, eleve_id, type_paiement, montant, canal, mois_concerne, created_at, eleves(nom, prenom, classes(nom))');
      if (pErr) throw pErr;

      if (paiements && paiements.length > 0) {
        const archiveRows = paiements.map((p: any) => ({
          session_id: sessionId,
          paiement_original_id: p.id,
          eleve_id: p.eleve_id,
          eleve_nom: p.eleves?.nom,
          eleve_prenom: p.eleves?.prenom,
          classe_nom: p.eleves?.classes?.nom,
          type_paiement: p.type_paiement,
          montant: p.montant,
          canal: p.canal,
          mois_concerne: p.mois_concerne,
          date_paiement: p.created_at,
        }));

        // Insert in batches of 500
        for (let i = 0; i < archiveRows.length; i += 500) {
          const batch = archiveRows.slice(i, i + 500);
          const { error } = await supabase.from('paiements_archive').insert(batch);
          if (error) throw error;
        }
      }

      // Mark session as closed
      const { error } = await supabase
        .from('sessions_scolaires')
        .update({ cloturee: true, cloturee_at: new Date().toISOString(), cloturee_par: user?.id, active: false })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Session clôturée et données archivées');
      queryClient.invalidateQueries({ queryKey: ['sessions-scolaires'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Promote students
  const promoteStudents = useMutation({
    mutationFn: async () => {
      if (!promotionSessionId) throw new Error('Sélectionnez une session');

      const promotions: any[] = [];

      for (const eleve of eleves) {
        if (redoublants.has(eleve.id)) {
          // Log as redoublant (stays in same class)
          promotions.push({
            session_id: promotionSessionId,
            eleve_id: eleve.id,
            ancien_classe_id: eleve.classe_id,
            ancien_classe_nom: eleve.classes?.nom,
            nouveau_classe_id: eleve.classe_id,
            nouveau_classe_nom: eleve.classes?.nom,
            type: 'redoublement',
            created_by: user?.id,
          });
          continue;
        }

        const currentClassName = eleve.classes?.nom || '';
        const prefix = getClassPrefix(currentClassName);
        if (!prefix) continue;

        const nextPrefix = PROMOTION_MAP[prefix];
        if (!nextPrefix) continue; // Terminal class

        // Find target class (first match with next prefix + same section letter if applicable)
        const section = currentClassName.match(/[-\s]+([A-Z])$/)?.[1];
        let targetClass = classes.find((c: any) => {
          const cPrefix = getClassPrefix(c.nom);
          if (cPrefix !== nextPrefix) return false;
          if (section) {
            return c.nom.toUpperCase().endsWith(section);
          }
          return true;
        });

        // Fallback: any class with that prefix
        if (!targetClass) {
          targetClass = classes.find((c: any) => getClassPrefix(c.nom) === nextPrefix);
        }

        if (targetClass) {
          promotions.push({
            session_id: promotionSessionId,
            eleve_id: eleve.id,
            ancien_classe_id: eleve.classe_id,
            ancien_classe_nom: currentClassName,
            nouveau_classe_id: targetClass.id,
            nouveau_classe_nom: targetClass.nom,
            type: 'promotion',
            created_by: user?.id,
          });

          // Update student class
          await supabase
            .from('eleves')
            .update({ classe_id: targetClass.id, session_id: promotionSessionId, updated_at: new Date().toISOString() })
            .eq('id', eleve.id);
        }
      }

      if (promotions.length > 0) {
        for (let i = 0; i < promotions.length; i += 500) {
          const batch = promotions.slice(i, i + 500);
          const { error } = await supabase.from('promotions_log').insert(batch);
          if (error) throw error;
        }
      }

      return promotions.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} élèves promus/traités avec succès`);
      setRedoublants(new Set());
      queryClient.invalidateQueries({ queryKey: ['eleves-promotion'] });
      queryClient.invalidateQueries({ queryKey: ['promotions-log'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleRedoublant = (id: string) => {
    setRedoublants(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group eleves by class
  const elevesByClass = useMemo(() => {
    const map: Record<string, any[]> = {};
    eleves.forEach((e: any) => {
      const key = e.classes?.nom || 'Sans classe';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [eleves]);

  const totalArchive = archives.reduce((s: number, a: any) => s + Number(a.montant || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarPlus className="h-6 w-6 text-primary" />
            Gestion des Années Scolaires
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Créer, activer et clôturer les sessions scolaires</p>
        </div>
        {activeSession && (
          <Badge className="bg-primary text-primary-foreground text-sm px-4 py-1.5 gap-2">
            <CheckCircle className="h-4 w-4" />
            Session en cours : {activeSession.nom}
          </Badge>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="sessions" className="gap-1.5">
            <CalendarPlus className="h-4 w-4" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="promotion" className="gap-1.5">
            <RefreshCcw className="h-4 w-4" /> Promotion
          </TabsTrigger>
          <TabsTrigger value="archives" className="gap-1.5">
            <History className="h-4 w-4" /> Archives
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-1.5">
            <Users className="h-4 w-4" /> Historique
          </TabsTrigger>
        </TabsList>

        {/* ============ TAB: Sessions ============ */}
        <TabsContent value="sessions" className="space-y-6">
          {/* Create new session */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-primary" />
                Nouvelle Session Scolaire
              </CardTitle>
              <CardDescription>Créez une nouvelle année scolaire</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nom de la session</Label>
                  <Input placeholder="2026-2027" value={newNom} onChange={e => setNewNom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input type="date" value={newDebut} onChange={e => setNewDebut(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input type="date" value={newFin} onChange={e => setNewFin(e.target.value)} />
                </div>
              </div>
              <Button
                className="mt-4 gap-2"
                disabled={!newNom || !newDebut || !newFin || createSession.isPending}
                onClick={() => createSession.mutate()}
              >
                {createSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                Créer la session
              </Button>
            </CardContent>
          </Card>

          {/* List sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Sessions existantes</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Aucune session créée</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Début</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold">{s.nom}</TableCell>
                        <TableCell>{new Date(s.date_debut).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>{new Date(s.date_fin).toLocaleDateString('fr-FR')}</TableCell>
                        <TableCell>
                          {s.cloturee ? (
                            <Badge variant="secondary" className="gap-1"><Archive className="h-3 w-3" /> Clôturée</Badge>
                          ) : s.active ? (
                            <Badge className="bg-emerald-600 text-white gap-1"><Play className="h-3 w-3" /> Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {!s.cloturee && !s.active && (
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => activateSession.mutate(s.id)}>
                              <Play className="h-3.5 w-3.5" /> Activer
                            </Button>
                          )}
                          {s.active && !s.cloturee && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" className="gap-1">
                                  <Archive className="h-3.5 w-3.5" /> Clôturer
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                    <AlertTriangle className="h-5 w-5" />
                                    Clôturer la session "{s.nom}" ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="space-y-2">
                                    <p className="font-semibold text-destructive">⚠️ Attention, cette action est irréversible et archivera les données actuelles.</p>
                                    <ul className="list-disc pl-4 space-y-1 text-sm">
                                      <li>Tous les paiements seront archivés</li>
                                      <li>La session sera définitivement clôturée</li>
                                      <li>Les données archivées resteront consultables dans l'onglet Archives</li>
                                    </ul>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => closeSession.mutate(s.id)}
                                  >
                                    Clôturer définitivement
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: Promotion ============ */}
        <TabsContent value="promotion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-primary" />
                Promotion des Élèves
              </CardTitle>
              <CardDescription>
                Promouvoir les élèves vers le niveau supérieur. Cochez les redoublants avant de lancer la migration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <Label>Session de destination</Label>
                  <Select value={promotionSessionId} onValueChange={setPromotionSessionId}>
                    <SelectTrigger><SelectValue placeholder="Choisir la nouvelle session" /></SelectTrigger>
                    <SelectContent>
                      {sessions.filter((s: any) => !s.cloturee).map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!promotionSessionId || promoteStudents.isPending} className="gap-2">
                      {promoteStudents.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      Promouvoir les élèves ({eleves.length - redoublants.size} promus, {redoublants.size} redoublants)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Confirmer la promotion
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        <p><strong>{eleves.length - redoublants.size}</strong> élèves seront promus au niveau supérieur.</p>
                        <p><strong>{redoublants.size}</strong> élèves sont marqués comme redoublants.</p>
                        <p className="mt-2 text-amber-600 font-medium">Cette opération modifiera les affectations de classe de tous les élèves.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => promoteStudents.mutate()}>
                        Confirmer la promotion
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="border rounded-lg max-h-[500px] overflow-auto">
                {elevesByClass.map(([className, classEleves]) => {
                  const prefix = getClassPrefix(className);
                  const nextPrefix = prefix ? PROMOTION_MAP[prefix] : null;
                  return (
                    <div key={className} className="border-b last:border-b-0">
                      <div className="bg-muted/50 px-4 py-2 flex items-center gap-2 sticky top-0 z-10">
                        <span className="font-semibold text-sm">{className}</span>
                        {nextPrefix && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" /> {nextPrefix}
                          </span>
                        )}
                        {!nextPrefix && prefix && (
                          <Badge variant="outline" className="text-xs">Classe terminale</Badge>
                        )}
                        <Badge variant="secondary" className="ml-auto text-xs">{classEleves.length} élèves</Badge>
                      </div>
                      <div className="divide-y">
                        {classEleves.map((e: any) => (
                          <div key={e.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30">
                            <Checkbox
                              checked={redoublants.has(e.id)}
                              onCheckedChange={() => toggleRedoublant(e.id)}
                            />
                            <span className="text-sm flex-1">{e.prenom} {e.nom}</span>
                            <span className="text-xs text-muted-foreground">{e.matricule}</span>
                            {redoublants.has(e.id) && (
                              <Badge variant="destructive" className="text-xs">Redoublant</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: Archives ============ */}
        <TabsContent value="archives" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Archives des Paiements
              </CardTitle>
              <CardDescription>Consultez l'historique des paiements des sessions clôturées</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={archiveSession} onValueChange={setArchiveSession}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="Sélectionner une session" /></SelectTrigger>
                <SelectContent>
                  {sessions.filter((s: any) => s.cloturee).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.nom} (Clôturée)</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {archiveSession && (
                <>
                  <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
                    <span className="text-sm font-medium">Total archivé :</span>
                    <span className="text-lg font-bold text-primary">{totalArchive.toLocaleString('fr-FR')} GNF</span>
                    <Badge variant="secondary">{archives.length} paiements</Badge>
                  </div>
                  <div className="border rounded-lg max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Élève</TableHead>
                          <TableHead>Classe</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {archives.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell>{a.eleve_prenom} {a.eleve_nom}</TableCell>
                            <TableCell>{a.classe_nom}</TableCell>
                            <TableCell><Badge variant="outline">{a.type_paiement}</Badge></TableCell>
                            <TableCell className="font-medium">{Number(a.montant).toLocaleString('fr-FR')} GNF</TableCell>
                            <TableCell>{a.canal}</TableCell>
                            <TableCell>{a.date_paiement ? new Date(a.date_paiement).toLocaleDateString('fr-FR') : '-'}</TableCell>
                          </TableRow>
                        ))}
                        {archives.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun paiement archivé pour cette session</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TAB: Historique promotions ============ */}
        <TabsContent value="historique" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Historique des Promotions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session</TableHead>
                      <TableHead>Ancienne classe</TableHead>
                      <TableHead>Nouvelle classe</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotionLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.sessions_scolaires?.nom || '-'}</TableCell>
                        <TableCell>{log.ancien_classe_nom}</TableCell>
                        <TableCell>{log.nouveau_classe_nom}</TableCell>
                        <TableCell>
                          <Badge variant={log.type === 'redoublement' ? 'destructive' : 'default'}>
                            {log.type === 'redoublement' ? 'Redoublant' : 'Promu'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleDateString('fr-FR')}</TableCell>
                      </TableRow>
                    ))}
                    {promotionLogs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune promotion enregistrée</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
