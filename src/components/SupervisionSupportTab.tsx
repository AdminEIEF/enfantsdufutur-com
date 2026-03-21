import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, MessageCircle, Send, Loader2, X, Camera, PenSquare, Users, MoreVertical, Plus, Smile } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
  'bg-teal-500', 'bg-orange-500',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export default function SupervisionSupportTab() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [activeConversation, setActiveConversation] = useState<ConversationSummary | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
        if (activeConversation) loadConversation(activeConversation.userId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase.from('support_messages').select('*').order('created_at', { ascending: false });
    if (data) setMessages(data as SupportMessage[]);
    setLoading(false);
  };

  const conversations: ConversationSummary[] = (() => {
    const map = new Map<string, ConversationSummary>();
    for (const msg of messages) {
      let userId: string, userName: string, userEmail: string;
      if (msg.sender_type === 'superviseur') {
        if (!msg.target_user_id) continue;
        userId = msg.target_user_id;
        userName = '';
        userEmail = '';
      } else {
        userId = msg.sender_id;
        userName = msg.sender_name;
        userEmail = msg.sender_email || '';
      }
      const existing = map.get(userId);
      if (!existing) {
        map.set(userId, {
          userId, userName: userName || 'Utilisateur', userEmail,
          lastMessage: msg.message, lastDate: msg.created_at,
          unreadCount: (!msg.lu && msg.sender_type !== 'superviseur' && msg.sender_id !== user?.id) ? 1 : 0,
          openCount: (msg.statut === 'ouvert' && msg.sender_type !== 'superviseur' && msg.sender_id !== user?.id) ? 1 : 0,
          totalMessages: 1,
        });
      } else {
        existing.totalMessages++;
        if (!msg.lu && msg.sender_type !== 'superviseur' && msg.sender_id !== user?.id) existing.unreadCount++;
        if (msg.statut === 'ouvert') existing.openCount++;
        if (userName && existing.userName === 'Utilisateur') existing.userName = userName;
        if (userEmail && !existing.userEmail) existing.userEmail = userEmail;
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

  const loadConversation = async (userId: string) => {
    setLoadingChat(true);
    const { data } = await supabase
      .from('support_messages').select('*')
      .or(`and(sender_id.eq.${userId},sender_type.neq.superviseur),and(target_user_id.eq.${userId},sender_type.eq.superviseur)`)
      .order('created_at', { ascending: true });
    setChatMessages((data || []) as SupportMessage[]);
    setLoadingChat(false);
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

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Sélectionnez une image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return; }
    setReplyImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setReplyImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => { setReplyImage(null); setReplyImagePreview(null); };

  const handleSendMessage = async () => {
    if (!activeConversation || (!replyText.trim() && !replyImage) || !user) return;
    setReplying(true);
    let imageUrl: string | null = null;
    if (replyImage) {
      const ext = replyImage.name.split('.').pop();
      const path = `messages/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('support-images').upload(path, replyImage);
      if (uploadError) { toast.error("Erreur lors de l'upload"); setReplying(false); return; }
      const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }
    const { error } = await supabase.from('support_messages').insert({
      sender_id: user.id, sender_type: 'superviseur', sender_name: 'Superviseur',
      sender_email: user.email, message: replyText.trim() || '📷 Image',
      target_user_id: activeConversation.userId, sender_image_url: imageUrl, statut: 'ouvert',
    });
    if (error) toast.error("Erreur lors de l'envoi");
    else { setReplyText(''); clearImage(); loadConversation(activeConversation.userId); fetchMessages(); }
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
        usersMap[r.user_id] = { user_id: r.user_id, email: profile?.email || '', display_name: profile?.display_name || null, roles: [], isOnline: onlineUserIds.has(r.user_id) };
      }
      usersMap[r.user_id].roles.push(r.role);
    }
    setRoleUsers(Object.values(usersMap).filter(u => u.user_id !== user?.id).sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)));
    setLoadingUsers(false);
  };

  const openNewMsgDialog = () => { setNewMsgDialog(true); setUserSearch(''); fetchRoleUsers(); };

  const selectUserFromDialog = (u: RoleUser) => {
    setNewMsgDialog(false);
    openConversation({
      userId: u.user_id, userName: u.display_name || u.email, userEmail: u.email,
      lastMessage: '', lastDate: new Date().toISOString(), unreadCount: 0, openCount: 0, totalMessages: 0,
    });
  };

  const filteredRoleUsers = roleUsers.filter(u => {
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return u.email?.toLowerCase().includes(s) || u.display_name?.toLowerCase().includes(s) || u.roles.some(r => r.toLowerCase().includes(s));
  });

  // ── RENDER ──
  return (
    <div className="flex border rounded-xl overflow-hidden bg-card" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
      {/* ─── LEFT PANEL: Conversation List ─── */}
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[340px] lg:w-[380px] border-r shrink-0`}>
        {/* Search header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Messages</h3>
            <Button size="icon" variant="ghost" onClick={openNewMsgDialog} className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm rounded-lg bg-muted/50 border-0 focus-visible:ring-1" />
          </div>
        </div>

        {/* Conversation items */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Aucune conversation</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversation?.userId === conv.userId;
              const color = getAvatarColor(conv.userName);
              return (
                <button
                  key={conv.userId}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-accent/50 ${isActive ? 'bg-accent' : ''}`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className={`${color} text-white text-sm font-semibold`}>
                        {getInitials(conv.userName)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online dot placeholder — you could check active_connections */}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                        {conv.userName}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {format(new Date(conv.lastDate), 'HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* ─── RIGHT PANEL: Chat Area ─── */}
      <div className={`${activeConversation ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
        {!activeConversation ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="h-10 w-10 opacity-30" />
            </div>
            <p className="text-sm font-medium">Sélectionnez une conversation</p>
            <p className="text-xs">ou créez-en une nouvelle</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" onClick={() => setActiveConversation(null)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </Button>
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className={`${getAvatarColor(activeConversation.userName)} text-white font-semibold text-sm`}>
                  {getInitials(activeConversation.userName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{activeConversation.userName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{activeConversation.userEmail}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-muted/20" ref={chatScrollRef}>
              {loadingChat ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <MessageCircle className="h-8 w-8 opacity-20" />
                  <p className="text-xs">Aucun message. Écrivez ci-dessous.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((msg) => {
                    const isMine = msg.sender_type === 'superviseur';
                    return (
                      <div key={msg.id} className="space-y-1">
                        <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Avatar */}
                          <Avatar className="h-8 w-8 shrink-0 mb-1">
                            <AvatarFallback className={`${isMine ? 'bg-primary' : getAvatarColor(msg.sender_name)} text-white text-xs font-semibold`}>
                              {getInitials(isMine ? 'Superviseur' : msg.sender_name)}
                            </AvatarFallback>
                          </Avatar>

                          <div className={`max-w-[70%] space-y-1`}>
                            {/* Name + time */}
                            <div className={`flex items-center gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                              <span className="text-xs font-semibold text-foreground">{isMine ? 'Superviseur' : msg.sender_name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(msg.created_at), 'HH:mm', { locale: fr })}
                              </span>
                            </div>
                            {/* Bubble */}
                            <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                              isMine
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-card border shadow-sm rounded-bl-sm'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                              {msg.sender_image_url && (
                                <a href={msg.sender_image_url} target="_blank" rel="noopener noreferrer">
                                  <img src={msg.sender_image_url} alt="Image" className="max-h-48 rounded-lg mt-2" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Legacy reply */}
                        {(msg.reply || msg.reply_image_url) && (
                          <div className="flex items-end gap-2 flex-row-reverse">
                            <Avatar className="h-8 w-8 shrink-0 mb-1">
                              <AvatarFallback className="bg-primary text-white text-xs font-semibold">SU</AvatarFallback>
                            </Avatar>
                            <div className="max-w-[70%] space-y-1">
                              <div className="flex items-center gap-2 flex-row-reverse">
                                <span className="text-xs font-semibold text-foreground">Superviseur</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {msg.replied_at && format(new Date(msg.replied_at), 'HH:mm', { locale: fr })}
                                </span>
                              </div>
                              <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm">
                                {msg.reply && <p className="whitespace-pre-wrap break-words">{msg.reply}</p>}
                                {msg.reply_image_url && (
                                  <a href={msg.reply_image_url} target="_blank" rel="noopener noreferrer">
                                    <img src={msg.reply_image_url} alt="Réponse" className="max-h-48 rounded-lg mt-2" />
                                  </a>
                                )}
                              </div>
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
            <div className="border-t bg-card px-4 py-3">
              {replyImagePreview && (
                <div className="relative inline-block mb-2">
                  <img src={replyImagePreview} alt="Aperçu" className="max-h-20 rounded-lg border" />
                  <button onClick={clearImage} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                  e.target.value = '';
                }} />
                <Button onClick={() => cameraInputRef.current?.click()} size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground">
                  <Plus className="h-5 w-5" />
                </Button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Tapez votre message..."
                    className="w-full h-10 rounded-full bg-muted/50 border-0 px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <Smile className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={(!replyText.trim() && !replyImage) || replying}
                  size="icon"
                  className="h-10 w-10 rounded-full shrink-0"
                >
                  {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Message Dialog */}
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
              <Input placeholder="Rechercher par nom, email ou rôle..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="max-h-[350px] border rounded-lg">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredRoleUsers.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Users className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  Aucun utilisateur trouvé
                </div>
              ) : (
                <div className="divide-y">
                  {filteredRoleUsers.map((u) => {
                    const color = getAvatarColor(u.display_name || u.email);
                    return (
                      <button key={u.user_id} onClick={() => selectUserFromDialog(u)} className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={`${color} text-white text-xs font-semibold`}>
                              {getInitials(u.display_name || u.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${u.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.display_name || u.email}</p>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {u.roles.map((r) => (
                              <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">{r}</Badge>
                            ))}
                          </div>
                        </div>
                        <span className={`text-[10px] shrink-0 ${u.isOnline ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {u.isOnline ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
