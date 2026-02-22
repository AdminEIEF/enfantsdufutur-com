import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParentAuth } from '@/hooks/useParentAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ParentNotifications() {
  const { session } = useParentAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetchAll();
  }, [session]);

  const fetchAll = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ code: session!.token, action: 'all_notifications' }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        setNotifications(data.notifications || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code: session!.token, action: 'mark_notification_read', notification_id: id }),
      }
    );
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
  };

  if (!session) { navigate('/parent', { replace: true }); return null; }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/parent/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Bell className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-sm">Toutes les notifications</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucune notification</p>
        ) : notifications.map((n: any) => (
          <Card key={n.id} className={!n.lu ? 'border-primary/30 bg-primary/5' : ''}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{n.titre}</p>
                    {!n.lu && <Badge variant="default" className="text-[10px]">Nouveau</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {format(new Date(n.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
                {!n.lu && (
                  <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => markRead(n.id)}>
                    Marquer lu
                  </Button>
                )}
              </div>
              {n.action_url && (
                <Button variant="link" size="sm" className="mt-1 text-xs p-0 h-auto" onClick={() => window.open(n.action_url, '_blank')}>
                  Voir le détail →
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
