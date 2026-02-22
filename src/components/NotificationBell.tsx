import { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Notification {
  id: string;
  titre: string;
  message: string;
  type: string;
  action_url?: string | null;
  lu: boolean;
  created_at: string;
}

interface NotificationBellProps {
  /** 'parent', 'student', or 'employee' */
  mode: 'parent' | 'student' | 'employee';
  /** famille_id for parent, eleve_id for student, employe_id for employee */
  targetId: string;
  /** Auth token for API calls */
  token: string;
  /** Navigate to archive */
  onViewAll?: () => void;
}

export function NotificationBell({ mode, targetId, token, onViewAll }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const fetchNotifications = useCallback(async () => {
    try {
      const action = 'notifications';
      const endpoint = mode === 'parent' ? 'parent-data' : mode === 'student' ? 'student-data' : 'employee-data';
      const body = mode === 'parent'
        ? { code: token, action }
        : { token, action };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );
      if (!resp.ok) return;
      const data = await resp.json();
      const notifs: Notification[] = data.notifications || [];
      setNotifications(notifs.slice(0, 5));
      setUnreadCount(data.unread_count || notifs.filter(n => !n.lu).length);
    } catch {
      // silent
    }
  }, [mode, token]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    const tableName = mode === 'parent' ? 'parent_notifications' : mode === 'student' ? 'student_notifications' : 'employee_notifications';
    const filterColumn = mode === 'parent' ? 'famille_id' : mode === 'student' ? 'eleve_id' : 'employe_id';

    const channel = supabase
      .channel(`${tableName}-${targetId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: tableName,
          filter: `${filterColumn}=eq.${targetId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 5));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mode, targetId]);

  const markAsRead = async (id: string) => {
    try {
      const action = 'mark_notification_read';
      const endpoint = mode === 'parent' ? 'parent-data' : mode === 'student' ? 'student-data' : 'employee-data';
      const body = mode === 'parent'
        ? { code: token, action, notification_id: id }
        : { token, action, notification_id: id };

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, lu: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'commande': return '🛒';
      case 'paiement': return '💳';
      case 'cantine': return '🍽️';
      case 'info': return 'ℹ️';
      case 'action': return '⚡';
      case 'emploi_du_temps': return '📅';
      case 'credit': return '💰';
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
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    !notif.lu ? 'bg-primary/5' : ''
                  }`}
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
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                    {!notif.lu && (
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {onViewAll && (
          <div className="border-t px-4 py-2">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setOpen(false); onViewAll(); }}>
              Voir toutes les notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>

      {/* Message detail dialog */}
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
              <div className="space-y-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedNotif.message}</p>
                {selectedNotif.action_url && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(selectedNotif.action_url!, '_blank')}>
                    ⚡ Ouvrir le lien
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
