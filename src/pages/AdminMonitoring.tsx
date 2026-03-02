import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Shield, ShieldOff, Wifi, WifiOff, Activity, Search, Eye, Ban, CheckCircle, Clock, Users, FileText, GraduationCap, Briefcase, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ActiveConnection {
  id: string;
  type: string;
  ref_id: string;
  display_name: string;
  email: string | null;
  classe_nom: string | null;
  niveau_nom: string | null;
  cycle_nom: string | null;
  categorie: string | null;
  poste: string | null;
  extra_info: any;
  connected_at: string;
  last_seen_at: string;
}

interface UserSession {
  id: string;
  user_id: string;
  email: string;
  connected_at: string;
  disconnected_at: string | null;
  ip_address: string | null;
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
  INSERT: { label: 'Création', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  UPDATE: { label: 'Modification', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  DELETE: { label: 'Suppression', color: 'bg-destructive/15 text-destructive' },
};

const TABLE_LABELS: Record<string, string> = {
  eleves: 'Élèves', familles: 'Familles', paiements: 'Paiements',
  notes: 'Notes', depenses: 'Dépenses', classes: 'Classes', employes: 'Employés',
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  eleve: { label: 'Élèves', icon: GraduationCap, color: 'text-blue-600 dark:text-blue-400' },
  parent: { label: 'Parents', icon: Users, color: 'text-emerald-600 dark:text-emerald-400' },
  employe: { label: 'Employés', icon: Briefcase, color: 'text-amber-600 dark:text-amber-400' },
  admin: { label: 'Administrateurs', icon: Shield, color: 'text-primary' },
};

export default function AdminMonitoring() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [searchConnections, setSearchConnections] = useState('');
  const [searchAudit, setSearchAudit] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailDialog, setDetailDialog] = useState<AuditEntry | null>(null);
  const [connectionDetail, setConnectionDetail] = useState<ActiveConnection | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<ProfileUser | null>(null);
  const [auditLimit, setAuditLimit] = useState(50);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchConnections(), fetchSessions(), fetchAuditLog(), fetchUsers()]);
    setLoading(false);
  };

  const fetchConnections = async () => {
    const { data } = await supabase
      .from('active_connections')
      .select('*')
      .order('connected_at', { ascending: false })
      .limit(500);
    if (data) setConnections(data as ActiveConnection[]);
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

  // Realtime
  useEffect(() => {
    const ch1 = supabase.channel('audit-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, (p) => {
        setAuditLog(prev => [p.new as AuditEntry, ...prev].slice(0, 500));
      }).subscribe();

    const ch2 = supabase.channel('connections-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'active_connections' }, (p) => {
        setConnections(prev => [p.new as ActiveConnection, ...prev].slice(0, 500));
      }).subscribe();

    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, []);

  const toggleBlock = async (profile: ProfileUser) => {
    const newBlocked = !profile.blocked;
    const { error } = await supabase.from('profiles').update({
      blocked: newBlocked,
      blocked_at: newBlocked ? new Date().toISOString() : null,
      blocked_by: newBlocked ? user?.id : null,
    }).eq('user_id', profile.user_id);
    if (error) toast.error('Erreur');
    else { toast.success(newBlocked ? 'Utilisateur bloqué' : 'Utilisateur débloqué'); fetchUsers(); }
    setConfirmBlock(null);
  };

  // Group connections by type
  const connectionsByType = useMemo(() => {
    const map: Record<string, ActiveConnection[]> = { eleve: [], parent: [], employe: [], admin: [] };
    connections.forEach(c => { if (map[c.type]) map[c.type].push(c); });
    return map;
  }, [connections]);

  // Group students by class
  const studentsByClass = useMemo(() => {
    const map: Record<string, ActiveConnection[]> = {};
    connectionsByType.eleve.forEach(c => {
      const key = c.classe_nom || 'Non assigné';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [connectionsByType.eleve]);

  // Employees by category
  const employeesByCategory = useMemo(() => {
    const map: Record<string, ActiveConnection[]> = {};
    connectionsByType.employe.forEach(c => {
      const key = c.categorie || 'Autre';
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [connectionsByType.employe]);

  const filteredAudit = useMemo(() => {
    let filtered = auditLog;
    if (searchAudit) {
      const q = searchAudit.toLowerCase();
      filtered = filtered.filter(a => a.user_email?.toLowerCase().includes(q) || a.table_name?.toLowerCase().includes(q) || a.action?.toLowerCase().includes(q));
    }
    return filtered.slice(0, auditLimit);
  }, [auditLog, searchAudit, auditLimit]);

  const filteredUsers = useMemo(() => {
    if (!searchUsers) return users;
    const q = searchUsers.toLowerCase();
    return users.filter(u => u.email?.toLowerCase().includes(q));
  }, [users, searchUsers]);

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: fr }); } catch { return d; }
  };

  const catLabels: Record<string, string> = { enseignant: '👨‍🏫 Enseignants', service: '🔧 Service', administration: '📋 Administration', direction: '👔 Direction' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Supervision Système
          </h1>
          <p className="text-muted-foreground text-sm">Surveillance en temps réel des connexions et modifications</p>
        </div>
        <Badge variant="outline" className="gap-1 text-sm">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
          Temps réel
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['eleve', 'parent', 'employe', 'admin'] as const).map(type => {
          const cfg = TYPE_CONFIG[type];
          const Icon = cfg.icon;
          return (
            <Card key={type}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${cfg.color}`} />
                <div>
                  <p className="text-xl font-bold">{connectionsByType[type]?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold">{auditLog.length}</p>
              <p className="text-xs text-muted-foreground">Modifications</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Comparison Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Comparaison des connexions par profil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const chartData = [
                { name: 'Élèves', value: connectionsByType.eleve.length, fill: 'hsl(217, 91%, 60%)' },
                { name: 'Parents', value: connectionsByType.parent.length, fill: 'hsl(160, 84%, 39%)' },
                { name: 'Employés', value: connectionsByType.employe.length, fill: 'hsl(38, 92%, 50%)' },
                { name: 'Admins', value: connectionsByType.admin.length, fill: 'hsl(262, 83%, 58%)' },
              ];
              const total = chartData.reduce((s, d) => s + d.value, 0);
              if (total === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Aucune connexion active</p>;
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v} connecté${v > 1 ? 's' : ''}`, 'Total']} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Répartition des utilisateurs connectés
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const pieData = [
                { name: 'Élèves', value: connectionsByType.eleve.length, fill: 'hsl(217, 91%, 60%)' },
                { name: 'Parents', value: connectionsByType.parent.length, fill: 'hsl(160, 84%, 39%)' },
                { name: 'Employés', value: connectionsByType.employe.length, fill: 'hsl(38, 92%, 50%)' },
                { name: 'Admins', value: connectionsByType.admin.length, fill: 'hsl(262, 83%, 58%)' },
              ].filter(d => d.value > 0);
              const total = pieData.reduce((s, d) => s + d.value, 0);
              if (total === 0) return <p className="text-center text-muted-foreground py-8 text-sm">Aucune connexion active</p>;
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} connecté${v > 1 ? 's' : ''}`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connected">
        <TabsList>
          <TabsTrigger value="connected" className="gap-1"><Wifi className="h-4 w-4" /> Connectés</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1"><Activity className="h-4 w-4" /> Journal d'audit</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" /> Gestion accès</TabsTrigger>
        </TabsList>

        {/* === CONNECTED USERS === */}
        <TabsContent value="connected" className="space-y-4">
          {/* Students by class */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Élèves connectés
                <Badge variant="secondary">{connectionsByType.eleve.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {studentsByClass.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun élève connecté</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {studentsByClass.map(([classe, eleves]) => (
                    <AccordionItem key={classe} value={classe}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{classe}</span>
                          <Badge variant="outline">{eleves.length} élève{eleves.length > 1 ? 's' : ''}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {eleves.map(e => (
                            <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setConnectionDetail(e)}>
                              <div className="flex items-center gap-2">
                                <Wifi className="h-3 w-3 text-emerald-500" />
                                <span className="font-medium text-sm">{e.display_name}</span>
                                {e.extra_info?.matricule && <span className="text-xs text-muted-foreground">({e.extra_info.matricule})</span>}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(e.connected_at)}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Parents */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Parents connectés
                <Badge variant="secondary">{connectionsByType.parent.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {connectionsByType.parent.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun parent connecté</p>
              ) : (
                <div className="space-y-1">
                  {connectionsByType.parent.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setConnectionDetail(p)}>
                      <div className="flex items-center gap-2">
                        <Wifi className="h-3 w-3 text-emerald-500" />
                        <span className="font-medium text-sm">{p.display_name}</span>
                        {p.extra_info?.nb_enfants && <Badge variant="outline" className="text-xs">{p.extra_info.nb_enfants} enfant{p.extra_info.nb_enfants > 1 ? 's' : ''}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(p.connected_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employees by category */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Employés connectés
                <Badge variant="secondary">{connectionsByType.employe.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeesByCategory.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Aucun employé connecté</p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {employeesByCategory.map(([cat, emps]) => (
                    <AccordionItem key={cat} value={cat}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{catLabels[cat] || cat}</span>
                          <Badge variant="outline">{emps.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {emps.map(e => (
                            <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setConnectionDetail(e)}>
                              <div className="flex items-center gap-2">
                                <Wifi className="h-3 w-3 text-emerald-500" />
                                <span className="font-medium text-sm">{e.display_name}</span>
                                {e.poste && <span className="text-xs text-muted-foreground">— {e.poste}</span>}
                              </div>
                              <span className="text-xs text-muted-foreground">{formatDate(e.connected_at)}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Admins */}
          {connectionsByType.admin.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Administrateurs connectés
                  <Badge variant="secondary">{connectionsByType.admin.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {connectionsByType.admin.map(a => (
                    <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer" onClick={() => setConnectionDetail(a)}>
                      <div className="flex items-center gap-2">
                        <Wifi className="h-3 w-3 text-emerald-500" />
                        <span className="font-medium text-sm">{a.email || a.display_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(a.connected_at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === AUDIT LOG === */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  Journal d'audit en temps réel
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
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
                      const info = ACTION_LABELS[a.action] || { label: a.action, color: 'bg-muted' };
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm font-mono whitespace-nowrap">{formatDate(a.created_at)}</TableCell>
                          <TableCell className="font-medium text-sm">{a.user_email || 'Système'}</TableCell>
                          <TableCell><Badge className={info.color}>{info.label}</Badge></TableCell>
                          <TableCell className="text-sm">{TABLE_LABELS[a.table_name] || a.table_name}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setDetailDialog(a)} className="gap-1"><Eye className="h-3 w-3" /> Voir</Button>
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
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 gap-1"><CheckCircle className="h-3 w-3" /> Actif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.blocked_at ? formatDate(u.blocked_at) : '—'}</TableCell>
                      <TableCell className="text-right">
                        {u.user_id !== user?.id && (
                          <Button variant={u.blocked ? 'outline' : 'destructive'} size="sm" onClick={() => setConfirmBlock(u)} className="gap-1">
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

      {/* Connection detail dialog */}
      <Dialog open={!!connectionDetail} onOpenChange={() => setConnectionDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Détails de connexion
            </DialogTitle>
          </DialogHeader>
          {connectionDetail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Nom :</span><br /><strong>{connectionDetail.display_name}</strong></div>
                <div><span className="text-muted-foreground">Type :</span><br /><Badge>{TYPE_CONFIG[connectionDetail.type]?.label || connectionDetail.type}</Badge></div>
                {connectionDetail.classe_nom && <div><span className="text-muted-foreground">Classe :</span><br /><strong>{connectionDetail.classe_nom}</strong></div>}
                {connectionDetail.niveau_nom && <div><span className="text-muted-foreground">Niveau :</span><br /><strong>{connectionDetail.niveau_nom}</strong></div>}
                {connectionDetail.cycle_nom && <div><span className="text-muted-foreground">Cycle :</span><br /><strong>{connectionDetail.cycle_nom}</strong></div>}
                {connectionDetail.categorie && <div><span className="text-muted-foreground">Catégorie :</span><br /><strong>{connectionDetail.categorie}</strong></div>}
                {connectionDetail.poste && <div><span className="text-muted-foreground">Poste :</span><br /><strong>{connectionDetail.poste}</strong></div>}
                {connectionDetail.email && <div><span className="text-muted-foreground">Email :</span><br /><strong>{connectionDetail.email}</strong></div>}
                <div><span className="text-muted-foreground">Connexion :</span><br /><strong>{formatDate(connectionDetail.connected_at)}</strong></div>
              </div>
              {connectionDetail.extra_info && Object.keys(connectionDetail.extra_info).length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Informations supplémentaires :</span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {connectionDetail.extra_info.matricule && <div className="text-xs"><span className="text-muted-foreground">Matricule :</span> <strong>{connectionDetail.extra_info.matricule}</strong></div>}
                    {connectionDetail.extra_info.telephone && <div className="text-xs"><span className="text-muted-foreground">Tél :</span> <strong>{connectionDetail.extra_info.telephone}</strong></div>}
                    {connectionDetail.extra_info.telephone_pere && <div className="text-xs"><span className="text-muted-foreground">Tél père :</span> <strong>{connectionDetail.extra_info.telephone_pere}</strong></div>}
                    {connectionDetail.extra_info.telephone_mere && <div className="text-xs"><span className="text-muted-foreground">Tél mère :</span> <strong>{connectionDetail.extra_info.telephone_mere}</strong></div>}
                    {connectionDetail.extra_info.enfants && <div className="text-xs col-span-2"><span className="text-muted-foreground">Enfants :</span> <strong>{connectionDetail.extra_info.enfants}</strong></div>}
                    {connectionDetail.extra_info.sexe && <div className="text-xs"><span className="text-muted-foreground">Sexe :</span> <strong>{connectionDetail.extra_info.sexe === 'M' ? 'Masculin' : 'Féminin'}</strong></div>}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit detail dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Détails de la modification</DialogTitle>
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
                ? `Rétablir l'accès pour ${confirmBlock?.email} ?`
                : `Bloquer l'accès de ${confirmBlock?.email} à l'application ?`}
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
