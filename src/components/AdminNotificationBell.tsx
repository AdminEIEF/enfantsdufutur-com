import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface AdminNotification {
  id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean | null;
  created_at: string;
  destinataire_type: string;
}

export function AdminNotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AdminNotification | null>(null);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const notifs = (data || []) as AdminNotification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.lu).length);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as AdminNotification;
        setNotifications(prev => [newNotif, ...prev].slice(0, 10));
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ lu: true } as any).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'alerte': return '⚠️';
      case 'info': return 'ℹ️';
      case 'action': return '⚡';
      case 'inscription': return '📝';
      case 'paiement': return '💳';
      case 'boutique': return '🛍️';
      case 'librairie': return '📚';
      case 'cantine': return '🍽️';
      case 'personnel': return '👤';
      default: return '📢';
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</p>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Aucune notification</p>
            ) : (
              <div className="divide-y">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${!notif.lu ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      if (!notif.lu) markAsRead(notif.id);
                      setSelectedNotif(notif);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">{typeIcon(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${!notif.lu ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notif.titre}
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      {!notif.lu && <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="border-t px-4 py-2">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              Voir toutes les notifications
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!selectedNotif} onOpenChange={(v) => { if (!v) setSelectedNotif(null); }}>
        <DialogContent className="max-w-md w-[95vw]">
          {selectedNotif && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span>{typeIcon(selectedNotif.type)}</span>
                  {selectedNotif.titre}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {format(new Date(selectedNotif.created_at), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedNotif.message}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
