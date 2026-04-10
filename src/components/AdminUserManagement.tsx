import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Loader2, Copy, CheckCircle2, Shield, Users, Eye, EyeOff, KeyRound, Pencil, Save, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  const [editForm, setEditForm] = useState({ nom: '', prenom: '', email: '', role: '' });
  const [form, setForm] = useState({
    email: '',
    nom: '',
    prenom: '',
    role: '',
    password: '',
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: allRoles } = await supabase.from('user_roles').select('*');

      return (profiles || []).map((p: any) => ({
        ...p,
        roles: (allRoles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role),
      }));
    },
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
        toast.error('Un compte avec cet email existe déjà. Veuillez utiliser un autre email.');
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Gestion des utilisateurs</CardTitle>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" /> Créer un compte
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Créer un nouveau compte
              </DialogTitle>
            </DialogHeader>

            {showSuccess ? (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">Compte créé avec succès !</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    L'utilisateur devra changer ce mot de passe à la première connexion.
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Mot de passe temporaire :</p>
                  <div className="flex items-center gap-2 justify-center">
                    <code className="text-lg font-mono font-bold">
                      {showCreatedPwd ? createdPassword : '••••••••••••'}
                    </code>
                    <Button variant="ghost" size="icon" onClick={() => setShowCreatedPwd(!showCreatedPwd)} title={showCreatedPwd ? 'Masquer' : 'Afficher'}>
                      {showCreatedPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(createdPassword); toast.success('Copié !'); }}>
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
                    <Label>Prénom *</Label>
                    <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom *</Label>
                    <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Rôle *</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe (optionnel)</Label>
                  <div className="flex gap-2">
                    <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Laissez vide = auto-généré" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}>
                      Générer
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">L'utilisateur devra le changer à la première connexion.</p>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Créer le compte
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun utilisateur trouvé</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle(s)</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <button
                        className="font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                        onClick={() => setSelectedUser(u)}
                      >
                        {u.prenom} {u.nom}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {u.roles?.map((r: string) => (
                          <Badge key={r} variant="outline" className={ROLE_COLORS[r] || ''}>
                            {ROLE_LABELS[r] || r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.must_change_password ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                          1ère connexion
                        </Badge>
                      ) : u.blocked ? (
                        <Badge variant="destructive">Bloqué</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Actif</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(v) => { if (!v) { setSelectedUser(null); setResetPwd(''); setShowResetPwd(false); setEditing(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Détails de l'utilisateur</span>
              {selectedUser && !editing && (
                <Button variant="outline" size="sm" onClick={() => {
                  setEditing(true);
                  setEditForm({
                    nom: selectedUser.nom || '',
                    prenom: selectedUser.prenom || '',
                    email: selectedUser.email || '',
                    role: selectedUser.roles?.[0] || '',
                  });
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {editing ? (
                /* Edit mode */
                <div className="space-y-3">
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
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Annuler</Button>
                    <Button className="flex-1" disabled={saving || !editForm.nom || !editForm.prenom || !editForm.email || !editForm.role} onClick={async () => {
                      setSaving(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('admin-session-action', {
                          body: {
                            action: 'update_user',
                            user_id: selectedUser.user_id,
                            nom: editForm.nom,
                            prenom: editForm.prenom,
                            email: editForm.email,
                            new_role: editForm.role,
                            display_name: `${editForm.prenom} ${editForm.nom}`,
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
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {selectedUser.prenom?.[0]}{selectedUser.nom?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{selectedUser.prenom} {selectedUser.nom}</p>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Rôle(s)</p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {selectedUser.roles?.length > 0 ? selectedUser.roles.map((r: string) => (
                          <Badge key={r} variant="outline" className={ROLE_COLORS[r] || ''}>
                            {ROLE_LABELS[r] || r}
                          </Badge>
                        )) : <span className="text-muted-foreground">Aucun</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Statut</p>
                      <div className="mt-1">
                        {selectedUser.must_change_password ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">1ère connexion</Badge>
                        ) : selectedUser.blocked ? (
                          <Badge variant="destructive">Bloqué</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Actif</Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Créé le</p>
                      <p className="mt-1">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('fr-FR') : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ID utilisateur</p>
                      <p className="mt-1 font-mono text-xs truncate">{selectedUser.user_id || selectedUser.id}</p>
                    </div>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-sm text-muted-foreground font-medium">Mot de passe</p>
                    {resetPwd ? (
                      <div className="bg-muted rounded-lg p-3 space-y-1">
                        <p className="text-xs text-muted-foreground">Nouveau mot de passe temporaire :</p>
                        <div className="flex items-center gap-2 justify-center">
                          <code className="text-lg font-mono font-bold">
                            {showResetPwd ? resetPwd : '••••••••••••'}
                          </code>
                          <Button variant="ghost" size="icon" onClick={() => setShowResetPwd(!showResetPwd)}>
                            {showResetPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(resetPwd); toast.success('Copié !'); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">L'utilisateur devra le changer à la prochaine connexion.</p>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
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
                        {resettingPwd ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                        Réinitialiser le mot de passe
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setSelectedUser(null); setResetPwd(''); setShowResetPwd(false); }}>Fermer</Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
