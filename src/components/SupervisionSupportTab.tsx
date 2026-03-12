import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, MessageCircle, Send, Loader2, CheckCircle, Clock, AlertCircle, X, Camera, PenSquare, Users, ArrowLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  sender_image_url: string | null;
  replied_at: string | null;
  lu: boolean;
  statut: string;
  created_at: string;
  target_user_id: string | null;
}

interface ConversationSummary {
  userId: string;
  userName: string;
  userEmail: string;
  lastMessage: string;
  lastDate: string;
  unreadCount: number;
  openCount: number;
  totalMessages: number;
}

export default function SupervisionSupportTab() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Conversation view
  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // New message dialog
  const [newMsgDialog, setNewMsgDialog] = useState(false);
  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('support-messages-supervisor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
        fetchMessages();
        if (activeConversation) {
          loadConversation(activeConversation.userId);
        }
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

  // Group messages into conversations by user
  const conversations: ConversationSummary[] = (() => {
    const map = new Map<string, ConversationSummary>();
    for (const msg of messages) {
      // Determine the "other" user (not superviseur)
      let userId: string;
      let userName: string;
      let userEmail: string;

      if (msg.sender_type === 'superviseur') {
        // Message sent BY superviseur TO someone
        if (!msg.target_user_id) continue;
        userId = msg.target_user_id;
        userName = ''; // will be resolved
        userEmail = '';
      } else {
        // Message sent BY a user
        userId = msg.sender_id;
        userName = msg.sender_name;
        userEmail = msg.sender_email || '';
      }

      const existing = map.get(userId);
      if (!existing) {
        map.set(userId, {
          userId,
          userName: userName || 'Utilisateur',
          userEmail,
          lastMessage: msg.message,
          lastDate: msg.created_at,
          unreadCount: (!msg.lu && msg.sender_type !== 'superviseur') ? 1 : 0,
          openCount: msg.statut === 'ouvert' ? 1 : 0,
          totalMessages: 1,
        });
      } else {
        existing.totalMessages++;
        if (!msg.lu && msg.sender_type !== 'superviseur') existing.unreadCount++;
        if (msg.statut === 'ouvert') existing.openCount++;
        // Update name if we have a better one
        if (userName && existing.userName === 'Utilisateur') {
          existing.userName = userName;
        }
        if (userEmail && !existing.userEmail) {
          existing.userEmail = userEmail;
        }
        // Keep last message (messages are ordered desc)
        if (new Date(msg.created_at) > new Date(existing.lastDate)) {
          existing.lastMessage = msg.message;
          existing.lastDate = msg.created_at;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  })();

  const filteredConversations = conversations.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.userName.toLowerCase().includes(s) || c.userEmail.toLowerCase().includes(s);
  });

  const openCount = messages.filter(m => m.statut === 'ouvert' && m.sender_type !== 'superviseur').length;
  const enCoursCount = messages.filter(m => m.statut === 'en_cours').length;

  // Load conversation messages for a user
  const loadConversation = async (userId: string) => {
    setLoadingChat(true);
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .or(`and(sender_id.eq.${userId},sender_type.neq.superviseur),and(target_user_id.eq.${userId},sender_type.eq.superviseur)`)
      .order('created_at', { ascending: true });
    setChatMessages((data || []) as SupportMessage[]);
    setLoadingChat(false);

    // Mark unread messages as read
    if (data) {
      const unreadIds = data.filter(m => !m.lu && m.sender_type !== 'superviseur').map(m => m.id);
      if (unreadIds.length > 0) {
        await supabase.from('support_messages').update({ lu: true }).in('id', unreadIds);
        fetchMessages();
      }
    }

    setTimeout(() => {
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }, 150);
  };

  const openConversation = (conv: ConversationSummary) => {
    setActiveConversation(conv);
    setReplyText('');
    clearImage();
    loadConversation(conv.userId);
  };

  const closeConversation = () => {
    setActiveConversation(null);
    setChatMessages([]);
    setReplyText('');
    clearImage();
  };

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Sélectionnez une image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return; }
    setReplyImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setReplyImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setReplyImage(null);
    setReplyImagePreview(null);
  };

  const handleSendMessage = async () => {
    if (!activeConversation || (!replyText.trim() && !replyImage) || !user) return;
    setReplying(true);

    let imageUrl: string | null = null;
    if (replyImage) {
      const ext = replyImage.name.split('.').pop();
      const path = `messages/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('support-images').upload(path, replyImage);
      if (uploadError) {
        toast.error("Erreur lors de l'upload de l'image");
        setReplying(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('support_messages').insert({
      sender_id: user.id,
      sender_type: 'superviseur',
      sender_name: 'Superviseur',
      sender_email: user.email,
      message: replyText.trim() || '📷 Image',
      target_user_id: activeConversation.userId,
      sender_image_url: imageUrl,
      statut: 'ouvert',
    });

    if (error) {
      toast.error("Erreur lors de l'envoi");
    } else {
      setReplyText('');
      clearImage();
      loadConversation(activeConversation.userId);
      fetchMessages();
    }
    setReplying(false);
  };

  // New message dialog
  const fetchRoleUsers = async () => {
    setLoadingUsers(true);
    const [{ data: rolesData }, { data: connections }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('active_connections').select('ref_id, type').eq('type', 'admin'),
    ]);
    if (!rolesData || rolesData.length === 0) { setLoadingUsers(false); return; }

    const onlineUserIds = new Set((connections || []).map(c => c.ref_id));
    const userIds = [...new Set(rolesData.map(r => r.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, email, display_name').in('user_id', userIds);

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
    setRoleUsers(Object.values(usersMap).filter(u => u.user_id !== user?.id).sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)));
    setLoadingUsers(false);
  };

  const openNewMsgDialog = () => {
    setNewMsgDialog(true);
    setUserSearch('');
    fetchRoleUsers();
  };

  const selectUserFromDialog = (u: RoleUser) => {
    setNewMsgDialog(false);
    const conv: ConversationSummary = {
      userId: u.user_id,
      userName: u.display_name || u.email,
      userEmail: u.email,
      lastMessage: '',
      lastDate: new Date().toISOString(),
      unreadCount: 0,
      openCount: 0,
      totalMessages: 0,
    };
    openConversation(conv);
  };

  const filteredRoleUsers = roleUsers.filter(u => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return u.email?.toLowerCase().includes(s) || u.display_name?.toLowerCase().includes(s) || u.roles.some(r => r.toLowerCase().includes(s));
  });

  // ── RENDER ──

  // If a conversation is open, show chat view
  if (activeConversation) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeConversation}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">{activeConversation.userName}</h2>
            <p className="text-xs text-muted-foreground truncate">{activeConversation.userEmail}</p>
          </div>
        </div>

        {/* Chat area */}
        <Card>
          <CardContent className="p-0">
            <div className="h-[450px] overflow-y-auto p-4" ref={chatScrollRef}>
              {loadingChat ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Aucun message. Écrivez ci-dessous.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg) => {
                    const isMine = msg.sender_type === 'superviseur';
                    return (
                      <div key={msg.id} className="space-y-1.5">
                        <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-2xl px-3.5 py-2.5 max-w-[80%] text-sm ${
                            isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                          }`}>
                            {!isMine && <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.sender_name}</p>}
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                            {msg.sender_image_url && (
                              <a href={msg.sender_image_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.sender_image_url} alt="Image" className="max-h-40 rounded-lg mt-1.5" />
                              </a>
                            )}
                            <p className={`text-[10px] mt-1 opacity-60 ${isMine ? 'text-right' : ''}`}>
                              {format(new Date(msg.created_at), 'dd/MM HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        {/* Legacy reply field */}
                        {(msg.reply || msg.reply_image_url) && (
                          <div className="flex justify-end">
                            <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2.5 max-w-[80%] text-sm">
                              <p className="text-[10px] font-medium opacity-70 mb-0.5">Superviseur</p>
                              {msg.reply && <p className="whitespace-pre-wrap">{msg.reply}</p>}
                              {msg.reply_image_url && (
                                <a href={msg.reply_image_url} target="_blank" rel="noopener noreferrer">
                                  <img src={msg.reply_image_url} alt="Réponse" className="max-h-40 rounded-lg mt-1.5" />
                                </a>
                              )}
                              <p className="text-[10px] mt-1 opacity-60 text-right">
                                {msg.replied_at && format(new Date(msg.replied_at), 'dd/MM HH:mm', { locale: fr })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t p-3 space-y-2">
              {replyImagePreview && (
                <div className="relative inline-block">
                  <img src={replyImagePreview} alt="Aperçu" className="max-h-20 rounded-lg border" />
                  <button onClick={clearImage} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                  e.target.value = '';
                }} />
                <Button onClick={() => cameraInputRef.current?.click()} size="icon" variant="outline" className="shrink-0 self-end">
                  <Camera className="h-4 w-4" />
                </Button>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Votre message..."
                  className="min-h-[50px] max-h-[100px] text-sm resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                />
                <Button onClick={handleSendMessage} disabled={(!replyText.trim() && !replyImage) || replying} size="icon" className="shrink-0 self-end">
                  {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main: conversation list ──
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
              <p className="text-xs text-muted-foreground">Non lus</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{conversations.length}</p>
              <p className="text-xs text-muted-foreground">Conversations</p>
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

      {/* Search + new message */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openNewMsgDialog} className="gap-2">
          <PenSquare className="h-4 w-4" /> Nouveau
        </Button>
      </div>

      {/* Conversation list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune conversation</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.userId}
                  onClick={() => openConversation(conv)}
                  className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {conv.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>
                        {conv.userName}
                      </p>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-primary text-primary-foreground border-0 text-[10px] px-1.5 py-0 h-4 min-w-[16px] flex items-center justify-center">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.userEmail}</p>
                    <p className={`text-xs mt-0.5 truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {conv.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(conv.lastDate), 'dd/MM HH:mm', { locale: fr })}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{conv.totalMessages} msg</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Message Dialog - user picker */}
      <Dialog open={newMsgDialog} onOpenChange={setNewMsgDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="h-5 w-5 text-primary" />
              Écrire à un utilisateur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email ou rôle..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="max-h-[350px] border rounded-lg">
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
                      onClick={() => selectUserFromDialog(u)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${u.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.display_name || u.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className={`text-[10px] shrink-0 ${u.isOnline ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {u.isOnline ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-0.5 flex-wrap ml-4.5">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">{r}</Badge>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
