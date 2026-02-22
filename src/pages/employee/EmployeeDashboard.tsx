import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Calendar, Clock, FileText, Briefcase, AlertTriangle, DollarSign, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeeDashboard() {
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

  const emp = session.employe;
  const categorieLabel: Record<string, string> = {
    enseignant: '👨‍🏫 Enseignant',
    administration: '🏢 Administration',
    service: '🔧 Service',
    direction: '👔 Direction',
  };

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Welcome */}
          <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-200">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl font-bold text-emerald-700">
                {emp.prenom[0]}{emp.nom[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold">{emp.prenom} {emp.nom}</h2>
                <p className="text-sm text-muted-foreground">{emp.poste} — {categorieLabel[emp.categorie] || emp.categorie}</p>
                <p className="text-xs text-muted-foreground">Matricule: {emp.matricule}</p>
              </div>
            </CardContent>
          </Card>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-xl font-bold">{data?.pointages?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Pointages ce mois</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                <div className="text-xl font-bold">{data?.pointages?.filter((p: any) => p.retard)?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Retards</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-xl font-bold">{data?.conges?.filter((c: any) => c.statut === 'en_attente')?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Congés en attente</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                <div className="text-xl font-bold">{data?.bulletins?.length || 0}</div>
                <p className="text-xs text-muted-foreground">Bulletins de paie</p>
              </CardContent>
            </Card>
          </div>

          {/* Enseignant - classes & emploi du temps */}
          {emp.categorie === 'enseignant' && data?.classes?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Mes classes & emploi du temps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {data.classes.map((ec: any) => (
                    <Badge key={ec.id} variant="secondary" className="text-xs">
                      {ec.classes?.nom} — {ec.matieres?.nom || 'Toutes matières'}
                    </Badge>
                  ))}
                </div>
                {/* Cours à venir */}
                {data?.cours_enseignant?.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">📚 Contenus de cours publiés</p>
                    {data.cours_enseignant.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                        <div className="flex-1">
                          <span className="font-medium">{c.titre}</span>
                          <span className="text-muted-foreground ml-2">{c.classes?.nom} — {c.matieres?.nom}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{c.type_contenu}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                {/* Devoirs */}
                {data?.devoirs_enseignant?.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">📝 Devoirs en cours</p>
                    {data.devoirs_enseignant.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between text-xs border rounded px-2 py-1.5">
                        <div className="flex-1">
                          <span className="font-medium">{d.titre}</span>
                          <span className="text-muted-foreground ml-2">{d.classes?.nom} — {d.matieres?.nom}</span>
                        </div>
                        <span className="text-muted-foreground">{format(new Date(d.date_limite), 'dd/MM/yyyy')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Derniers pointages */}
          {data?.pointages?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Derniers pointages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.pointages.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <span className="font-medium">{format(new Date(p.date_pointage), 'EEEE dd MMM', { locale: fr })}</span>
                      <div className="flex items-center gap-2">
                        {p.heure_arrivee && <span className="text-xs">{format(new Date(p.heure_arrivee), 'HH:mm')}</span>}
                        {p.heure_depart && <span className="text-xs">→ {format(new Date(p.heure_depart), 'HH:mm')}</span>}
                        {p.retard && <Badge variant="destructive" className="text-[10px]">Retard</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avances en cours */}
          {data?.avances?.filter((a: any) => a.statut === 'approuve' || a.statut === 'en_cours')?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Avances en cours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.avances.filter((a: any) => a.statut !== 'refuse' && a.statut !== 'rembourse').map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span>{Number(a.montant).toLocaleString()} GNF</span>
                      <Badge variant={a.statut === 'en_attente' ? 'secondary' : 'default'}>{a.statut}</Badge>
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
