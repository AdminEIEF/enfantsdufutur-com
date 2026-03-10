import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { MessageCircle, X, Send, Loader2, CheckCircle, Clock, ImagePlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface SupportMessage {
  id: string;
  message: string;
  reply: string | null;
  reply_image_url: string | null;
  sender_image_url: string | null;
  statut: string;
  created_at: string;
  replied_at: string | null;
}

export function SupportChat() {
  const { user, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Don't show for superviseur (they have the tab in supervision)
  const isSuperviseur = hasRole('superviseur');
  
  useEffect(() => {
    if (!user || isSuperviseur) return;
    fetchMessages();
    
    // Realtime subscription
    const channel = supabase
      .channel('support-messages-user')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_messages',
        filter: `sender_id=eq.${user.id}`,
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isSuperviseur]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const fetchMessages = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_messages')
      .select('id, message, reply, reply_image_url, sender_image_url, statut, created_at, replied_at')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: true });
    if (data) {
      setMessages(data as SupportMessage[]);
      setUnreadCount(data.filter((m: any) => m.reply && !m.lu).length);
    }
    setLoading(false);
  };

  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Sélectionnez une image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return; }
    setAttachedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => { setAttachedImage(null); setImagePreview(null); };

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachedImage) || !user) return;
    setSending(true);

    let imageUrl: string | null = null;
    if (attachedImage) {
      const ext = attachedImage.name.split('.').pop();
      const path = `messages/${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('support-images').upload(path, attachedImage);
      if (uploadError) {
        toast.error("Erreur lors de l'upload de l'image");
        setSending(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from('support_messages').insert({
      sender_id: user.id,
      sender_type: 'admin',
      sender_name: user.email?.split('@')[0] || 'Utilisateur',
      sender_email: user.email,
      message: newMessage.trim() || '📷 Image',
      sender_image_url: imageUrl,
    });
    if (error) {
      toast.error('Erreur lors de l\'envoi');
    } else {
      setNewMessage('');
      clearImage();
      toast.success('Message envoyé au superviseur');
      fetchMessages();
    }
    setSending(false);
  };

  if (isSuperviseur) return null;

  return (
    <>
      {/* Floating button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.5 }}
      >
        <Button
          onClick={() => setOpen(!open)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg bg-green-600 hover:bg-green-700 relative"
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          {unreadCount > 0 && !open && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </motion.div>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[500px] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-primary text-primary-foreground flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Assistance Technique</p>
                <p className="text-xs opacity-80">Écrire au superviseur</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 max-h-[320px] p-3" ref={scrollRef}>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Aucun message. Décrivez votre problème ci-dessous.
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className="space-y-1.5">
                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="bg-primary/10 text-foreground rounded-lg rounded-br-sm px-3 py-2 max-w-[85%] text-sm">
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">
                            {format(new Date(msg.created_at), 'dd/MM HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {/* Reply */}
                      {msg.reply && (
                        <div className="flex justify-start">
                          <div className="bg-muted rounded-lg rounded-bl-sm px-3 py-2 max-w-[85%] text-sm">
                            <p className="text-[10px] font-medium text-primary mb-0.5">Superviseur</p>
                            <p className="whitespace-pre-wrap">{msg.reply}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {msg.replied_at && format(new Date(msg.replied_at), 'dd/MM HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Status */}
                      {!msg.reply && (
                        <div className="flex justify-end">
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Clock className="h-3 w-3" />
                            En attente
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Décrivez votre problème..."
                  className="min-h-[60px] max-h-[100px] text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  size="icon"
                  className="shrink-0 self-end"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
