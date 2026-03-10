import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, MessageCircle, Send, Loader2, CheckCircle, Clock, AlertCircle, X, Camera, PenSquare, Users } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RoleUser {
  user_id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  isOnline: boolean;
}

interface SupportMessage {
  id: string;
  sender_id: string;
  sender_type: string;
  sender_name: string;
  sender_email: string | null;
  message: string;
  reply: string | null;
  reply_image_url: string | null;
  replied_at: string | null;
  lu: boolean;
  statut: string;
  created_at: string;
}

const STATUT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ouvert: { label: 'Ouvert', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', icon: AlertCircle },
  en_cours: { label: 'En cours', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', icon: Clock },
  resolu: { label: 'Résolu', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
};

export default function SupervisionSupportTab() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('all');
  const [replyDialog, setReplyDialog] = useState<SupportMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // New message dialog state
  const [newMsgDialog, setNewMsgDialog] = useState(false);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [newMsgText, setNewMsgText] = useState('');
  const [sendingNewMsg, setSendingNewMsg] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('support-messages-supervisor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        fetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setMessages(data as SupportMessage[]);
    setLoading(false);
  };

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop volumineuse (max 5 Mo)');
      return;
    }
    setReplyImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setReplyImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setReplyImage(null);
    setReplyImagePreview(null);
  };

  const handleReply = async () => {
    if (!replyDialog || (!replyText.trim() && !replyImage) || !user) return;
    setReplying(true);

    let imageUrl: string | null = null;

    // Upload image if present
    if (replyImage) {
      setUploadingImage(true);
      const ext = replyImage.name.split('.').pop();
      const path = `replies/${replyDialog.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('support-images')
        .upload(path, replyImage);
      setUploadingImage(false);

      if (uploadError) {
        toast.error("Erreur lors de l'upload de l'image");
        setReplying(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from('support_messages')
      .update({
        reply: replyText.trim() || null,
        reply_image_url: imageUrl,
        replied_by: user.id,
        replied_at: new Date().toISOString(),
        statut: 'resolu',
        lu: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', replyDialog.id);
    if (error) {
      toast.error('Erreur lors de la réponse');
    } else {
      toast.success('Réponse envoyée');
      setReplyDialog(null);
      setReplyText('');
      clearImage();
      fetchMessages();
    }
    setReplying(false);
  };

  const handleStatusChange = async (id: string, statut: string) => {
    await supabase.from('support_messages').update({ statut, updated_at: new Date().toISOString() }).eq('id', id);
    fetchMessages();
  };

  const fetchRoleUsers = async () => {
    setLoadingUsers(true);
    const [{ data: rolesData }, { data: connections }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('active_connections').select('ref_id, type').eq('type', 'admin'),
    ]);
    
    if (!rolesData || rolesData.length === 0) {
      setLoadingUsers(false);
      return;
    }

    const onlineUserIds = new Set((connections || []).map(c => c.ref_id));
    const userIds = [...new Set(rolesData.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .in('user_id', userIds);

    const usersMap: Record<string, RoleUser> = {};
    for (const r of rolesData) {
      if (!usersMap[r.user_id]) {
        const profile = profiles?.find(p => p.user_id === r.user_id);
        usersMap[r.user_id] = {
          user_id: r.user_id,
          email: profile?.email || '',
          display_name: profile?.display_name || null,
          roles: [],
          isOnline: onlineUserIds.has(r.user_id),
        };
      }
      usersMap[r.user_id].roles.push(r.role);
    }
    const list = Object.values(usersMap)
      .filter(u => u.user_id !== user?.id)
      .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
    setRoleUsers(list);
    setLoadingUsers(false);
  };

  const openNewMsgDialog = () => {
    setNewMsgDialog(true);
    setSelectedUserId('');
    setNewMsgText('');
    setUserSearch('');
    fetchRoleUsers();
  };

  const handleSendNewMsg = async () => {
    if (!selectedUserId || !newMsgText.trim() || !user) return;
    setSendingNewMsg(true);
    const targetUser = roleUsers.find(u => u.user_id === selectedUserId);
    const { error } = await supabase.from('support_messages').insert({
      sender_id: user.id,
      sender_type: 'superviseur',
      sender_name: 'Superviseur',
      sender_email: user.email,
      message: newMsgText.trim(),
      target_user_id: selectedUserId,
      statut: 'ouvert',
    });
    if (error) {
      toast.error('Erreur lors de l\'envoi');
    } else {
      toast.success(`Message envoyé à ${targetUser?.display_name || targetUser?.email}`);
      setNewMsgDialog(false);
      fetchMessages();
    }
    setSendingNewMsg(false);
  };

  const filteredRoleUsers = roleUsers.filter(u => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return (u.email?.toLowerCase().includes(s)) || 
           (u.display_name?.toLowerCase().includes(s)) ||
           u.roles.some(r => r.toLowerCase().includes(s));
  });

  const filtered = messages.filter((m) => {
    const matchSearch = !search || 
      m.sender_name.toLowerCase().includes(search.toLowerCase()) ||
      m.sender_email?.toLowerCase().includes(search.toLowerCase()) ||
      m.message.toLowerCase().includes(search.toLowerCase());
    const matchStatut = filterStatut === 'all' || m.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const openCount = messages.filter(m => m.statut === 'ouvert').length;
  const enCoursCount = messages.filter(m => m.statut === 'en_cours').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-xs text-muted-foreground">Ouvert(s)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{enCoursCount}</p>
              <p className="text-xs text-muted-foreground">En cours</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{messages.length}</p>
              <p className="text-xs text-muted-foreground">Total messages</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email ou contenu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="ouvert">Ouvert</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="resolu">Résolu</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openNewMsgDialog} className="gap-2">
          <PenSquare className="h-4 w-4" /> Nouveau message
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Aucun message de support</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expéditeur</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((msg) => {
                  const cfg = STATUT_CONFIG[msg.statut] || STATUT_CONFIG.ouvert;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={msg.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{msg.sender_name}</p>
                          <p className="text-xs text-muted-foreground">{msg.sender_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="text-sm truncate">{msg.message}</p>
                        {(msg as any).sender_image_url && (
                          <a href={(msg as any).sender_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">📷 Image envoyée</a>
                        )}
                        {msg.reply && (
                          <p className="text-xs text-emerald-600 mt-0.5 truncate">↳ {msg.reply}</p>
                        )}
                        {msg.reply_image_url && (
                          <a href={msg.reply_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">📷 Capture jointe</a>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${cfg.color} border-0 gap-1`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {msg.statut === 'ouvert' && (
                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(msg.id, 'en_cours')}>
                              <Clock className="h-3.5 w-3.5 mr-1" /> En cours
                            </Button>
                          )}
                          <Button size="sm" onClick={() => { setReplyDialog(msg); setReplyText(msg.reply || ''); clearImage(); }}>
                            <Send className="h-3.5 w-3.5 mr-1" /> Répondre
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={!!replyDialog} onOpenChange={() => setReplyDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Répondre à {replyDialog?.sender_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Message original :</p>
              <p className="text-sm whitespace-pre-wrap">{replyDialog?.message}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                {replyDialog && format(new Date(replyDialog.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Votre réponse..."
              className="min-h-[100px]"
            />

            {/* Image upload section */}
            <div className="flex items-center gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                  e.target.value = '';
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="h-4 w-4 mr-1" /> Capture
              </Button>
            </div>

            {/* Image preview */}
            {replyImagePreview && (
              <div className="relative inline-block">
                <img src={replyImagePreview} alt="Aperçu" className="max-h-40 rounded-lg border" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={clearImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplyDialog(null); clearImage(); }}>Annuler</Button>
            <Button onClick={handleReply} disabled={(!replyText.trim() && !replyImage) || replying}>
              {replying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer la réponse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Message Dialog */}
      <Dialog open={newMsgDialog} onOpenChange={setNewMsgDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="h-5 w-5 text-primary" />
              Écrire à un utilisateur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* User search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un utilisateur..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* User list */}
            <ScrollArea className="max-h-[200px] border rounded-lg">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRoleUsers.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Users className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  Aucun utilisateur trouvé
                </div>
              ) : (
                <div className="divide-y">
                  {filteredRoleUsers.map((u) => (
                    <button
                      key={u.user_id}
                      onClick={() => setSelectedUserId(u.user_id)}
                      className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
                        selectedUserId === u.user_id ? 'bg-primary/10 border-l-2 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${u.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.display_name || u.email}</p>
                          {u.display_name && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                        </div>
                        <span className={`text-[10px] shrink-0 ${u.isOnline ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {u.isOnline ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap ml-4.5">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message */}
            <Textarea
              value={newMsgText}
              onChange={(e) => setNewMsgText(e.target.value)}
              placeholder="Votre message..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMsgDialog(false)}>Annuler</Button>
            <Button onClick={handleSendNewMsg} disabled={!selectedUserId || !newMsgText.trim() || sendingNewMsg}>
              {sendingNewMsg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
