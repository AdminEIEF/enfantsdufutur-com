import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import type { AppRole } from '@/hooks/useAuth';

interface AdminNotification {
  id: string;
  titre: string;
  message: string;
  type: string;
  lu: boolean | null;
  created_at: string;
  destinataire_type: string;
  destinataire_ref: string | null;
}

// Map each app role to the destinataire_type values it should see
function getAllowedTypes(roles: AppRole[]): string[] {
  const types = new Set<string>();

  for (const role of roles) {
    // Everyone sees 'staff'
    types.add('staff');

    switch (role) {
      case 'superviseur':
      case 'admin':
        // See everything
        types.add('admin');
        types.add('famille');
        types.add('transport');
        types.add('cantine');
        types.add('librairie');
        types.add('boutique');
        types.add('comptable');
        types.add('tresorier');
        types.add('coordinateur');
        types.add('coordinateur_secondaire');
        break;
      case 'tresorier':
      case 'comptable':
        types.add('admin');
        types.add('tresorier');
        types.add('comptable');
        break;
      case 'coordinateur':
        types.add('coordinateur');
        break;
      case 'coordinateur_secondaire':
        types.add('coordinateur_secondaire');
        break;
      case 'cantine':
        types.add('cantine');
        break;
      case 'librairie':
        types.add('librairie');
        break;
      case 'boutique':
        types.add('boutique');
        break;
      case 'chauffeur':
        types.add('transport');
        break;
      case 'pointeur':
      case 'surveillant':
        types.add('pointeur');
        break;
      case 'secretaire':
        types.add('admin');
        types.add('secretaire');
        break;
      case 'service_info':
        types.add('admin');
        types.add('service_info');
        break;
      case 'robotique':
        types.add('robotique');
        break;
    }
  }

  return Array.from(types);
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // silent fallback
  }
}

interface Props {
  roles: AppRole[];
}

export function AdminNotificationBell({ roles }: Props) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AdminNotification | null>(null);
  const initialLoadDone = useRef(false);
  const allowedTypes = getAllowedTypes(roles);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('destinataire_type', allowedTypes)
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) throw error;
      const notifs = (data || []) as AdminNotification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.lu).length);
      initialLoadDone.current = true;
    } catch {
      // silent
    }
  }, [allowedTypes.join(',')]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime — listen for new inserts, filter client-side by allowed types
  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const newNotif = payload.new as AdminNotification;
        // Only show if this notification is for this user's roles
        if (allowedTypes.includes(newNotif.destinataire_type)) {
          setNotifications(prev => [newNotif, ...prev].slice(0, 15));
          setUnreadCount(prev => prev + 1);
          if (initialLoadDone.current) {
            playNotificationSound();
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [allowedTypes.join(',')]);

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
      case 'reinscription': return '🔄';
      case 'transport': return '🚌';
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
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
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
