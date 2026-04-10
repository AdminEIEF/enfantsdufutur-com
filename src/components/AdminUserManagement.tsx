import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus, Loader2, Copy, CheckCircle2, Shield, Users, Eye, EyeOff,
  KeyRound, Pencil, Save, Trash2, Search, Mail, Calendar, Hash, X, UserCircle
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  superviseur: 'Superviseur',
  admin: 'Administrateur',
  secretaire: 'Secrétaire',
  service_info: 'Service Info',
  comptable: 'Comptable',
  boutique: 'Boutique',
  cantine: 'Cantine',
  librairie: 'Librairie',
  coordinateur: 'Coordinateur',
  coordinateur_secondaire: 'Coord. Secondaire',
  robotique: 'Robotique',
  chauffeur: 'Chauffeur de Bus',
  pointeur: 'Pointeur',
  surveillant: 'Surveillant',
  tresorier: 'Trésorier',
};

const ROLE_COLORS: Record<string, string> = {
  superviseur: 'bg-amber-600/10 text-amber-500 border-amber-600/20',
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  secretaire: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  service_info: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  comptable: 'bg-green-500/10 text-green-400 border-green-500/20',
  boutique: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  cantine: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  librairie: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  coordinateur: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  coordinateur_secondaire: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
  robotique: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  chauffeur: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  pointeur: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  surveillant: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  tresorier: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const ROLE_ICONS: Record<string, string> = {
  superviseur: '👑', admin: '🛡️', secretaire: '📋', service_info: '💻',
  comptable: '📊', boutique: '🛍️', cantine: '🍽️', librairie: '📚',
  coordinateur: '🎯', coordinateur_secondaire: '🎓', robotique: '🤖',
  chauffeur: '🚌', pointeur: '📍', surveillant: '👁️', tresorier: '💰',
};

export default function AdminUserManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCreatedPwd, setShowCreatedPwd] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [resettingPwd, setResettingPwd] = useState(false);
  const [resetPwd, setResetPwd] = useState('');
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ nom: '', prenom: '', email: '', role: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [form, setForm] = useState({
    email: '', nom: '', prenom: '', role: '', password: '',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const { data: allRoles } = await supabase.from('user_roles').select('*');
      return (profiles || []).map((p: any) => ({
        ...p,
        roles: (allRoles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
      }));
    },
  });

  const filteredUsers = users.filter((u: any) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || u.roles?.includes(filterRole);
    return matchSearch && matchRole;
  });

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.nom || !form.prenom || !form.role) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setCreating(true);
    const password = form.password || generatePassword();
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email: form.email, password, nom: form.nom, prenom: form.prenom, role: form.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCreatedPassword(password);
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast.success(`Compte créé pour ${form.prenom} ${form.nom}`);
    } catch (err: any) {
      const msg = err.message || 'Erreur lors de la création';
      if (msg.includes('already been registered') || msg.includes('email_exists')) {
        toast.error('Un compte avec cet email existe déjà.');
      } else {
        toast.error(msg);
      }
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setForm({ email: '', nom: '', prenom: '', role: '', password: '' });
    setCreatedPassword('');
    setShowSuccess(false);
    setShowCreatedPwd(false);
    setOpen(false);
  };

  const getStatusInfo = (u: any) => {
    if (u.must_change_password) return { label: '1ère connexion', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', dot: 'bg-amber-500' };
    if (u.blocked) return { label: 'Bloqué', color: 'bg-red-500/10 text-red-400 border-red-500/20', dot: 'bg-red-500' };
    return { label: 'Actif', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' };
  };

  // Stats
  const totalUsers = users.length;
  const activeUsers = users.filter((u: any) => !u.blocked && !u.must_change_password).length;
  const pendingUsers = users.filter((u: any) => u.must_change_password).length;

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Gestion des utilisateurs
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gérez les comptes et permissions du système</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4" /> Nouveau compte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                Créer un nouveau compte
              </DialogTitle>
            </DialogHeader>
            {showSuccess ? (
              <div className="space-y-5 text-center py-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-lg">Compte créé avec succès !</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Transmettez ce mot de passe temporaire à l'utilisateur.
                  </p>
                </div>
                <div className="bg-muted/50 backdrop-blur rounded-xl p-4 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Mot de passe temporaire</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="text-xl font-mono font-bold tracking-wider">
                      {showCreatedPwd ? createdPassword : '••••••••••••'}
                    </code>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCreatedPwd(!showCreatedPwd)}>
                      {showCreatedPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(createdPassword); toast.success('Copié !'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button onClick={resetForm} className="w-full">Fermer</Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Prénom *</Label>
                    <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Ex: Mamadou" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Nom *</Label>
                    <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Diallo" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="utilisateur@ecole.gn" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Rôle *</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span>{ROLE_ICONS[key]}</span> {label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Mot de passe</Label>
                  <div className="flex gap-2">
                    <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Auto-généré si vide" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}>
                      Générer
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">L'utilisateur devra le changer à la première connexion.</p>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Créer le compte
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">Total comptes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{activeUsers}</p>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{pendingUsers}</p>
            <p className="text-xs text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{ROLE_ICONS[key]} {label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">Aucun utilisateur trouvé</p>
            <p className="text-xs text-muted-foreground mt-1">Modifiez vos filtres ou créez un nouveau compte</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredUsers.map((u: any) => {
            const status = getStatusInfo(u);
            return (
              <Card
                key={u.id}
                className="group hover:shadow-md hover:border-primary/20 transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedUser(u)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0 group-hover:scale-105 transition-transform">
                      {u.prenom?.[0]}{u.nom?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{u.prenom} {u.nom}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                          <span className="text-[10px] text-muted-foreground">{status.label}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{u.email}</p>
                      <div className="flex gap-1 flex-wrap mt-2">
                        {u.roles?.map((r: string) => (
                          <Badge key={r} variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[r] || ''}`}>
                            {ROLE_ICONS[r]} {ROLE_LABELS[r] || r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(v) => { if (!v) { setSelectedUser(null); setResetPwd(''); setShowResetPwd(false); setEditing(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <UserCircle className="h-4 w-4 text-primary" />
                </div>
                Profil utilisateur
              </span>
              {selectedUser && !editing && (
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => {
                  setEditing(true);
                  setEditForm({
                    nom: selectedUser.nom || '',
                    prenom: selectedUser.prenom || '',
                    email: selectedUser.email || '',
                    role: selectedUser.roles?.[0] || '',
                  });
                }}>
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-5">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prénom</Label>
                      <Input value={editForm.prenom} onChange={e => setEditForm(f => ({ ...f, prenom: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nom</Label>
                      <Input value={editForm.nom} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rôle</Label>
                    <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{ROLE_ICONS[key]} {label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Annuler</Button>
                    <Button className="flex-1 gap-1.5" disabled={saving || !editForm.nom || !editForm.prenom || !editForm.email || !editForm.role} onClick={async () => {
                      setSaving(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('admin-session-action', {
                          body: {
                            action: 'update_user', user_id: selectedUser.user_id,
                            nom: editForm.nom, prenom: editForm.prenom, email: editForm.email,
                            new_role: editForm.role, display_name: `${editForm.prenom} ${editForm.nom}`,
                          },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        toast.success('Utilisateur mis à jour');
                        queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
                        setEditing(false);
                        setSelectedUser(null);
                      } catch (err: any) {
                        toast.error(err.message || 'Erreur lors de la mise à jour');
                      } finally {
                        setSaving(false);
                      }
                    }}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Hero section */}
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="h-20 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/5" />
                    <div className="px-4 pb-4 -mt-8">
                      <div className="flex items-end gap-3">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-bold text-xl shadow-lg border-4 border-background">
                          {selectedUser.prenom?.[0]}{selectedUser.nom?.[0]}
                        </div>
                        <div className="pb-1">
                          <p className="font-bold text-lg leading-tight">{selectedUser.prenom} {selectedUser.nom}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            {(() => { const s = getStatusInfo(selectedUser); return (
                              <Badge variant="outline" className={`text-[11px] ${s.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot} mr-1`} />{s.label}
                              </Badge>
                            ); })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider font-medium">Email</span>
                      </div>
                      <p className="text-sm font-medium truncate">{selectedUser.email}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Shield className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider font-medium">Rôle(s)</span>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {selectedUser.roles?.length > 0 ? selectedUser.roles.map((r: string) => (
                          <Badge key={r} variant="outline" className={`text-[10px] ${ROLE_COLORS[r] || ''}`}>
                            {ROLE_ICONS[r]} {ROLE_LABELS[r] || r}
                          </Badge>
                        )) : <span className="text-xs text-muted-foreground">Aucun</span>}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider font-medium">Créé le</span>
                      </div>
                      <p className="text-sm font-medium">
                        {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Hash className="h-3.5 w-3.5" />
                        <span className="text-[10px] uppercase tracking-wider font-medium">ID</span>
                      </div>
                      <p className="text-xs font-mono truncate">{selectedUser.user_id || selectedUser.id}</p>
                    </div>
                  </div>

                  {/* Password reset section */}
                  <div className="rounded-xl border border-border/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">Mot de passe</p>
                    </div>
                    {resetPwd ? (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">Nouveau mot de passe temporaire :</p>
                        <div className="flex items-center gap-2 justify-center">
                          <code className="text-lg font-mono font-bold tracking-wider">
                            {showResetPwd ? resetPwd : '••••••••••••'}
                          </code>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowResetPwd(!showResetPwd)}>
                            {showResetPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(resetPwd); toast.success('Copié !'); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center">L'utilisateur devra le changer à la prochaine connexion.</p>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        disabled={resettingPwd}
                        onClick={async () => {
                          setResettingPwd(true);
                          const newPwd = generatePassword();
                          try {
                            const { data, error } = await supabase.functions.invoke('admin-session-action', {
                              body: { action: 'change_password', type: 'admin_user', ref_id: selectedUser.user_id, new_password: newPwd },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setResetPwd(newPwd);
                            queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
                            toast.success('Mot de passe réinitialisé');
                          } catch (err: any) {
                            toast.error(err.message || 'Erreur');
                          } finally {
                            setResettingPwd(false);
                          }
                        }}
                      >
                        {resettingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                        Réinitialiser le mot de passe
                      </Button>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="flex-1 gap-1.5" disabled={deleting}>
                          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Supprimer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer le compte de <strong>{selectedUser.prenom} {selectedUser.nom}</strong> ({selectedUser.email}) ? Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              setDeleting(true);
                              try {
                                const { data, error } = await supabase.functions.invoke('admin-session-action', {
                                  body: { action: 'delete_user', user_id: selectedUser.user_id },
                                });
                                if (error) throw error;
                                if (data?.error) throw new Error(data.error);
                                toast.success('Compte supprimé avec succès');
                                queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
                                setSelectedUser(null);
                                setResetPwd('');
                                setShowResetPwd(false);
                              } catch (err: any) {
                                toast.error(err.message || 'Erreur lors de la suppression');
                              } finally {
                                setDeleting(false);
                              }
                            }}
                          >
                            Supprimer définitivement
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="outline" className="flex-1" onClick={() => { setSelectedUser(null); setResetPwd(''); setShowResetPwd(false); }}>
                      Fermer
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
