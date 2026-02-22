import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Bell, BellRing, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeeNotifications() {
  const { session } = useEmployeeAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = () => {
    if (!session) return;
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token: session.token, action: 'all_notifications' }),
    })
      .then(r => r.json())
      .then(d => setNotifications(d.notifications || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(fetchNotifs, [session]);

  const markRead = async (id: string) => {
    if (!session) return;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token: session.token, action: 'mark_notification_read', notification_id: id }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
  };

  if (!session) return null;

  return (
    <EmployeeLayout>
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : notifications.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">Aucune notification</CardContent></Card>
        ) : (
          notifications.map(n => (
            <Card
              key={n.id}
              className={`cursor-pointer transition-colors ${!n.lu ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
              onClick={() => { if (!n.lu) markRead(n.id); }}
            >
              <CardContent className="pt-4 flex items-start gap-3">
                <div className="mt-0.5">
                  {!n.lu ? <BellRing className="h-4 w-4 text-emerald-600" /> : <Check className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium text-sm truncate">{n.titre}</h3>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(n.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.message}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </EmployeeLayout>
  );
}
