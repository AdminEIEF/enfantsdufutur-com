import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, FileText, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function EmployeePaie() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
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

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="h-5 w-5" /> Mes bulletins de paie</h2>

          {/* Salaire info */}
          <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
            <CardContent className="pt-4 flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="text-sm text-muted-foreground">Salaire de base mensuel</p>
                <p className="text-xl font-bold">{Number(session.employe.salaire_base).toLocaleString()} GNF</p>
              </div>
            </CardContent>
          </Card>

          {(data?.bulletins || []).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Aucun bulletin de paie disponible</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.bulletins.map((b: any) => (
                <Card key={b.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">{MOIS_NOMS[b.mois]} {b.annee}</h3>
                      <Badge className="bg-emerald-500">{Number(b.salaire_net).toLocaleString()} GNF</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Salaire brut</span>
                        <span>{Number(b.salaire_brut).toLocaleString()}</span>
                      </div>
                      {b.primes > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Primes</span>
                          <span className="text-green-600">+{Number(b.primes).toLocaleString()}</span>
                        </div>
                      )}
                      {b.retenues > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Retenues</span>
                          <span className="text-red-600">-{Number(b.retenues).toLocaleString()}</span>
                        </div>
                      )}
                      {b.avances_deduites > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avances déduites</span>
                          <span className="text-orange-600">-{Number(b.avances_deduites).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    {b.commentaire && <p className="text-xs text-muted-foreground mt-2">{b.commentaire}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
