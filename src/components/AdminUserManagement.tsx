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
import { UserPlus, Loader2, Copy, CheckCircle2, Shield, Users, Eye, EyeOff } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  secretaire: 'Secrétaire',
  service_info: 'Service Info',
  comptable: 'Comptable',
  boutique: 'Boutique',
  cantine: 'Cantine',
  librairie: 'Librairie',
  coordinateur: 'Coordinateur',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  secretaire: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  service_info: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  comptable: 'bg-green-500/10 text-green-400 border-green-500/20',
  boutique: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  cantine: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  librairie: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  coordinateur: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

export default function AdminUserManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCreatedPwd, setShowCreatedPwd] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
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
      toast.error(err.message || 'Erreur lors de la création');
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
      <Dialog open={!!selectedUser} onOpenChange={(v) => { if (!v) setSelectedUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Détails de l'utilisateur</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
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
              <Button variant="outline" className="w-full" onClick={() => setSelectedUser(null)}>Fermer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
