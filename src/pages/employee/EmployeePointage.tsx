import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function EmployeePointage() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token: session.token, action: 'dashboard' }),
    })
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) return null;

  const allPointages = data?.allPointages || [];
  const filteredPointages = allPointages.filter((p: any) => {
    const d = new Date(p.date_pointage);
    return d.getMonth() + 1 === selectedMonth;
  });

  const totalRetards = filteredPointages.filter((p: any) => p.retard).length;
  const totalHeures = filteredPointages.reduce((sum: number, p: any) => sum + (p.heures_travaillees || 0), 0);

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5" /> Mon pointage
            </h2>
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOIS_NOMS.slice(1).map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{filteredPointages.length}</div>
                <p className="text-xs text-muted-foreground">Jours pointés</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold text-destructive">{totalRetards}</div>
                <p className="text-xs text-muted-foreground">Retards</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-xl font-bold">{totalHeures.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground">Total heures</p>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          {filteredPointages.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Aucun pointage pour {MOIS_NOMS[selectedMonth]}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {filteredPointages.map((p: any) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between text-sm border rounded px-3 py-2 ${
                        p.retard ? 'border-destructive/50 bg-destructive/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium min-w-[90px]">
                          {format(new Date(p.date_pointage), 'EEE dd MMM', { locale: fr })}
                        </span>
                        {p.retard && <Badge variant="destructive" className="text-[10px]">Retard</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {p.heure_arrivee && (
                          <span className={p.retard ? 'text-destructive font-semibold' : ''}>
                            🕐 {format(new Date(p.heure_arrivee), 'HH:mm')}
                          </span>
                        )}
                        {p.heure_depart && <span>→ {format(new Date(p.heure_depart), 'HH:mm')}</span>}
                        {p.heures_travaillees ? <span className="font-medium">{p.heures_travaillees}h</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
