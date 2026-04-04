import { useState, useEffect } from 'react';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Bell, BellRing, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function EmployeeNotifications() {
  const { session } = useEmployeeAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = () => {
    if (!session) return;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session.token, action: 'all_notifications' }),
    }).then(r => r.json()).then(d => setNotifications(d.notifications || [])).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(fetchNotifs, [session]);

  const markRead = async (id: string) => {
    if (!session) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session.token, action: 'mark_notification_read', notification_id: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
  };

  if (!session) return null;

  return (
    <EmployeeLayout>
      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Bell className="h-4.5 w-4.5 text-blue-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Notifications</h2>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucune notification</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/30">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.lu) markRead(n.id); }}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${!n.lu ? 'bg-emerald-500/5 hover:bg-emerald-500/10' : 'hover:bg-muted/30'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {!n.lu ? (
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <BellRing className="h-4 w-4 text-emerald-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center">
                          <Check className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm truncate ${!n.lu ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>{n.titre}</h3>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(n.created_at), 'dd MMM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </EmployeeLayout>
  );
}
