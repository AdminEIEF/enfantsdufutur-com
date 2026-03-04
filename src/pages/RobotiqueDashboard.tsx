import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Bot, Users, CheckCircle2, XCircle, CalendarDays, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

export default function RobotiqueDashboard() {
  const { user } = useAuth();
  const [inscrits, setInscrits] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent'>>({});
  const [existingRecords, setExistingRecords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyDate, setHistoryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchInscrits = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, classes(nom)')
      .eq('statut', 'inscrit')
      .eq('option_robotique', true)
      .is('deleted_at', null)
      .order('nom');
    if (data) setInscrits(data);

    // Fetch existing attendance for selected date
    const { data: att } = await supabase
      .from('robotics_attendance')
      .select('id, eleve_id, statut')
      .eq('date_seance', selectedDate);

    const attMap: Record<string, 'present' | 'absent'> = {};
    const idMap: Record<string, string> = {};
    if (att) {
      att.forEach((a: any) => {
        attMap[a.eleve_id] = a.statut;
        idMap[a.eleve_id] = a.id;
      });
    }
    setAttendance(attMap);
    setExistingRecords(idMap);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchInscrits();

    const channel = supabase
      .channel('robotique-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eleves' }, () => {
        fetchInscrits();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchInscrits]);

  const toggleStatus = (eleveId: string) => {
    setAttendance(prev => ({
      ...prev,
      [eleveId]: prev[eleveId] === 'present' ? 'absent' : 'present',
    }));
  };

  const markAll = (status: 'present' | 'absent') => {
    const newAtt: Record<string, 'present' | 'absent'> = {};
    inscrits.forEach(e => { newAtt[e.id] = status; });
    setAttendance(newAtt);
  };

  const saveAttendance = async () => {
    setSaving(true);
    const records = inscrits.map(e => ({
      eleve_id: e.id,
      date_seance: selectedDate,
      statut: attendance[e.id] || 'absent',
      created_by: user?.id,
    }));

    // Delete existing then insert
    await supabase.from('robotics_attendance').delete().eq('date_seance', selectedDate);
    const { error } = await supabase.from('robotics_attendance').insert(records);

    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success('Appel enregistré avec succès !');
      fetchInscrits();
    }
    setSaving(false);
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('robotics_attendance')
      .select('id, eleve_id, statut, date_seance, eleves(nom, prenom, matricule)')
      .eq('date_seance', historyDate)
      .order('eleves(nom)' as any);
    setHistoryData(data || []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [historyDate]);

  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = inscrits.length - presentCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Bot className="h-7 w-7 text-indigo-600" />
        <h1 className="text-2xl font-bold">Tableau de bord Robotique</h1>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
            <p className="text-3xl font-bold text-indigo-600">{inscrits.length}</p>
            <p className="text-sm text-muted-foreground">Inscrits total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
            <p className="text-3xl font-bold text-emerald-600">{presentCount}</p>
            <p className="text-sm text-muted-foreground">Présents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p className="text-3xl font-bold text-red-500">{absentCount}</p>
            <p className="text-sm text-muted-foreground">Absents</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="appel">
        <TabsList>
          <TabsTrigger value="appel">📋 Liste d'appel</TabsTrigger>
          <TabsTrigger value="historique">📅 Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="appel" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
            <Button size="sm" variant="outline" onClick={() => markAll('present')}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Tous présents
            </Button>
            <Button size="sm" variant="outline" onClick={() => markAll('absent')}>
              <XCircle className="h-4 w-4 mr-1" /> Tous absents
            </Button>
            <Button onClick={saveAttendance} disabled={saving || inscrits.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Enregistrer l'appel
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : inscrits.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun élève inscrit en Robotique</p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inscrits.map((e, i) => {
                    const status = attendance[e.id] || 'absent';
                    return (
                      <TableRow key={e.id} className={status === 'present' ? 'bg-emerald-50/50' : ''}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                        <TableCell><code className="text-xs">{e.matricule}</code></TableCell>
                        <TableCell>{(e.classes as any)?.nom || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={status === 'present' ? 'default' : 'outline'}
                              className={status === 'present' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                              onClick={() => toggleStatus(e.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Présent
                            </Button>
                            <Button
                              size="sm"
                              variant={status === 'absent' ? 'destructive' : 'outline'}
                              onClick={() => toggleStatus(e.id)}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Absent
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historique" className="space-y-4">
          <div className="flex items-center gap-4">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <Input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)} className="w-auto" />
            <span className="text-sm text-muted-foreground">
              {format(new Date(historyDate + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: fr })}
            </span>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : historyData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun appel enregistré pour cette date</p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((r: any, i) => (
                    <TableRow key={r.id} className={r.statut === 'present' ? 'bg-emerald-50/50' : ''}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{(r.eleves as any)?.prenom} {(r.eleves as any)?.nom}</TableCell>
                      <TableCell><code className="text-xs">{(r.eleves as any)?.matricule}</code></TableCell>
                      <TableCell>
                        {r.statut === 'present'
                          ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Présent</Badge>
                          : <Badge variant="destructive">Absent</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
