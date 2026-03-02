import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Shield, ShieldOff, Wifi, WifiOff, Activity, Search, Eye, Ban, CheckCircle, Clock, Users, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserSession {
  id: string;
  user_id: string;
  email: string;
  connected_at: string;
  disconnected_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface AuditEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  table_name: string;
  record_id: string;
  details: any;
  created_at: string;
}

interface ProfileUser {
  user_id: string;
  email: string;
  blocked: boolean;
  blocked_at: string | null;
  display_name: string | null;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Création', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  UPDATE: { label: 'Modification', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  DELETE: { label: 'Suppression', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const TABLE_LABELS: Record<string, string> = {
  eleves: 'Élèves',
  familles: 'Familles',
  paiements: 'Paiements',
  notes: 'Notes',
  depenses: 'Dépenses',
  classes: 'Classes',
  employes: 'Employés',
};

export default function AdminMonitoring() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [searchSessions, setSearchSessions] = useState('');
  const [searchAudit, setSearchAudit] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailDialog, setDetailDialog] = useState<AuditEntry | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<ProfileUser | null>(null);
  const [auditLimit, setAuditLimit] = useState(50);

  // Fetch data
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSessions(), fetchAuditLog(), fetchUsers()]);
    setLoading(false);
  };

  const fetchSessions = async () => {
    const { data } = await supabase
      .from('user_sessions')
      .select('*')
      .order('connected_at', { ascending: false })
      .limit(200);
    if (data) setSessions(data as UserSession[]);
  };

  const fetchAuditLog = async () => {
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (data) setAuditLog(data as AuditEntry[]);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, email, blocked, blocked_at, display_name');
    if (data) setUsers(data as ProfileUser[]);
  };

  // Realtime subscriptions
  useEffect(() => {
    const auditChannel = supabase
      .channel('audit-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, (payload) => {
        setAuditLog(prev => [payload.new as AuditEntry, ...prev].slice(0, 500));
      })
      .subscribe();

    const sessionChannel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(auditChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, []);

  // Toggle block
  const toggleBlock = async (profile: ProfileUser) => {
    const newBlocked = !profile.blocked;
    const { error } = await supabase
      .from('profiles')
      .update({
        blocked: newBlocked,
        blocked_at: newBlocked ? new Date().toISOString() : null,
        blocked_by: newBlocked ? user?.id : null,
      })
      .eq('user_id', profile.user_id);

    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      toast.success(newBlocked ? 'Utilisateur bloqué' : 'Utilisateur débloqué');
      fetchUsers();
    }
    setConfirmBlock(null);
  };

  // Active sessions (connected in last 30 min without disconnect)
  const activeSessions = useMemo(() => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    return sessions.filter(s => !s.disconnected_at && s.connected_at > thirtyMinAgo);
  }, [sessions]);

  // Filtered data
  const filteredSessions = useMemo(() => {
    if (!searchSessions) return sessions;
    const q = searchSessions.toLowerCase();
    return sessions.filter(s => s.email?.toLowerCase().includes(q));
  }, [sessions, searchSessions]);

  const filteredAudit = useMemo(() => {
    let filtered = auditLog;
    if (searchAudit) {
      const q = searchAudit.toLowerCase();
      filtered = filtered.filter(a =>
        a.user_email?.toLowerCase().includes(q) ||
        a.table_name?.toLowerCase().includes(q) ||
        a.action?.toLowerCase().includes(q)
      );
    }
    return filtered.slice(0, auditLimit);
  }, [auditLog, searchAudit, auditLimit]);

  const filteredUsers = useMemo(() => {
    if (!searchUsers) return users;
    const q = searchUsers.toLowerCase();
    return users.filter(u => u.email?.toLowerCase().includes(q));
  }, [users, searchUsers]);

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), 'dd/MM/yyyy HH:mm:ss', { locale: fr });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Supervision Système
          </h1>
          <p className="text-muted-foreground text-sm">Surveillance en temps réel des connexions et modifications</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Wifi className="h-3 w-3 text-green-500" />
            {activeSessions.length} en ligne
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {users.length} utilisateurs
          </Badge>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
                <p className="text-xs text-muted-foreground">Connectés maintenant</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-xs text-muted-foreground">Sessions totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{auditLog.length}</p>
                <p className="text-xs text-muted-foreground">Modifications enregistrées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.blocked).length}</p>
                <p className="text-xs text-muted-foreground">Utilisateurs bloqués</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-1"><Wifi className="h-4 w-4" /> Connexions</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1"><Activity className="h-4 w-4" /> Journal d'audit</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" /> Gestion accès</TabsTrigger>
        </TabsList>

        {/* === SESSIONS === */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Historique des connexions</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher par email..." value={searchSessions} onChange={e => setSearchSessions(e.target.value)} className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Statut</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Connexion</TableHead>
                      <TableHead>Déconnexion</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune session enregistrée</TableCell></TableRow>
                    ) : filteredSessions.map(s => {
                      const isActive = !s.disconnected_at && new Date(s.connected_at) > new Date(Date.now() - 30 * 60 * 1000);
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            {isActive ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1"><Wifi className="h-3 w-3" /> En ligne</Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Hors ligne</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{s.email || 'Inconnu'}</TableCell>
                          <TableCell className="text-sm">{formatDate(s.connected_at)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.disconnected_at ? formatDate(s.disconnected_at) : '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{s.ip_address || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === AUDIT LOG === */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  Journal d'audit en temps réel
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher..." value={searchAudit} onChange={e => setSearchAudit(e.target.value)} className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heure</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Détails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAudit.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune modification enregistrée</TableCell></TableRow>
                    ) : filteredAudit.map(a => {
                      const actionInfo = ACTION_LABELS[a.action] || { label: a.action, color: 'bg-muted' };
                      return (
                        <TableRow key={a.id} className="hover:bg-muted/50">
                          <TableCell className="text-sm font-mono whitespace-nowrap">{formatDate(a.created_at)}</TableCell>
                          <TableCell className="font-medium text-sm">{a.user_email || 'Système'}</TableCell>
                          <TableCell><Badge className={actionInfo.color}>{actionInfo.label}</Badge></TableCell>
                          <TableCell className="text-sm">{TABLE_LABELS[a.table_name] || a.table_name}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setDetailDialog(a)} className="gap-1">
                              <Eye className="h-3 w-3" /> Voir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {auditLog.length > auditLimit && (
                <div className="text-center mt-3">
                  <Button variant="outline" size="sm" onClick={() => setAuditLimit(l => l + 50)}>
                    Voir plus ({auditLog.length - auditLimit} restants)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === USER MANAGEMENT === */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Gestion des accès utilisateurs</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher par email..." value={searchUsers} onChange={e => setSearchUsers(e.target.value)} className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Bloqué le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun utilisateur</TableCell></TableRow>
                  ) : filteredUsers.map(u => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        {u.blocked ? (
                          <Badge variant="destructive" className="gap-1"><ShieldOff className="h-3 w-3" /> Bloqué</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle className="h-3 w-3" /> Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.blocked_at ? formatDate(u.blocked_at) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.user_id !== user?.id && (
                          <Button
                            variant={u.blocked ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => setConfirmBlock(u)}
                            className="gap-1"
                          >
                            {u.blocked ? <><CheckCircle className="h-3 w-3" /> Débloquer</> : <><Ban className="h-3 w-3" /> Bloquer</>}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails de la modification
            </DialogTitle>
            <DialogDescription>
              {detailDialog && `${ACTION_LABELS[detailDialog.action]?.label || detailDialog.action} sur ${TABLE_LABELS[detailDialog.table_name] || detailDialog.table_name}`}
            </DialogDescription>
          </DialogHeader>
          {detailDialog && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Utilisateur :</span> <strong>{detailDialog.user_email}</strong></div>
                  <div><span className="text-muted-foreground">Date :</span> <strong>{formatDate(detailDialog.created_at)}</strong></div>
                  <div><span className="text-muted-foreground">Table :</span> <strong>{TABLE_LABELS[detailDialog.table_name] || detailDialog.table_name}</strong></div>
                  <div><span className="text-muted-foreground">ID :</span> <code className="text-xs">{detailDialog.record_id}</code></div>
                </div>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(detailDialog.details, null, 2)}
                </pre>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm block dialog */}
      <Dialog open={!!confirmBlock} onOpenChange={() => setConfirmBlock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmBlock?.blocked ? 'Débloquer' : 'Bloquer'} cet utilisateur ?</DialogTitle>
            <DialogDescription>
              {confirmBlock?.blocked
                ? `Voulez-vous rétablir l'accès pour ${confirmBlock?.email} ?`
                : `Voulez-vous bloquer l'accès de ${confirmBlock?.email} à l'application ?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBlock(null)}>Annuler</Button>
            <Button variant={confirmBlock?.blocked ? 'default' : 'destructive'} onClick={() => confirmBlock && toggleBlock(confirmBlock)}>
              {confirmBlock?.blocked ? 'Débloquer' : 'Bloquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
