import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, BarChart3 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const CRITERIA_LABELS: Record<string, string> = {
  pedagogie: 'Pédagogie',
  ponctualite: 'Ponctualité',
  assiduite: 'Assiduité',
  relations: 'Relations',
  competences: 'Compétences',
  initiative: 'Initiative',
};

export default function EmployeeEvaluation() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const evaluations = data?.evaluations || [];
  const latestEval = evaluations[0];

  const radarData = latestEval
    ? Object.keys(CRITERIA_LABELS).map(key => ({
        criteria: CRITERIA_LABELS[key],
        score: Number(latestEval[key]) || 0,
        fullMark: 10,
      }))
    : [];

  const avgScore = latestEval
    ? (Object.keys(CRITERIA_LABELS).reduce((sum, k) => sum + (Number(latestEval[k]) || 0), 0) / Object.keys(CRITERIA_LABELS).length).toFixed(1)
    : null;

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Mon évaluation
          </h2>

          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Aucune évaluation disponible</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Latest evaluation radar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Évaluation — {latestEval.periode}</span>
                    <Badge className="bg-emerald-500">{avgScore}/10</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="criteria" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 10 }} />
                        <Radar
                          name="Score"
                          dataKey="score"
                          stroke="hsl(160, 60%, 45%)"
                          fill="hsl(160, 60%, 45%)"
                          fillOpacity={0.3}
                        />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Criteria details */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {radarData.map(item => (
                      <div key={item.criteria} className="flex items-center justify-between text-sm border rounded px-3 py-1.5">
                        <span className="text-muted-foreground">{item.criteria}</span>
                        <span className={`font-bold ${item.score >= 7 ? 'text-green-600' : item.score >= 5 ? 'text-orange-500' : 'text-destructive'}`}>
                          {item.score}/10
                        </span>
                      </div>
                    ))}
                  </div>

                  {latestEval.commentaire && (
                    <div className="mt-4 bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Commentaire</p>
                      <p className="text-sm">{latestEval.commentaire}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Previous evaluations */}
              {evaluations.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Historique des évaluations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {evaluations.slice(1).map((ev: any) => {
                        const avg = (Object.keys(CRITERIA_LABELS).reduce((s, k) => s + (Number(ev[k]) || 0), 0) / Object.keys(CRITERIA_LABELS).length).toFixed(1);
                        return (
                          <div key={ev.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                            <span className="font-medium">{ev.periode}</span>
                            <Badge variant={Number(avg) >= 7 ? 'default' : 'secondary'}>{avg}/10</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
