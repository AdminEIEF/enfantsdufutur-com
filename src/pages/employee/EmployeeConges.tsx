import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Plus, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function EmployeeConges() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [congeOpen, setCongeOpen] = useState(false);
  const [avanceOpen, setAvanceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Congé form
  const [typeConge, setTypeConge] = useState('annuel');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motifConge, setMotifConge] = useState('');

  // Avance form
  const [montantAvance, setMontantAvance] = useState('');
  const [motifAvance, setMotifAvance] = useState('');

  const fetchData = () => {
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
  };

  useEffect(fetchData, [session]);

  const submitConge = async () => {
    if (!dateDebut || !dateFin) { toast.error('Dates requises'); return; }
    setSubmitting(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          token: session!.token,
          action: 'demander_conge',
          conge: { type_conge: typeConge, date_debut: dateDebut, date_fin: dateFin, motif: motifConge },
        }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      toast.success('Demande de congé envoyée');
      setCongeOpen(false);
      setDateDebut(''); setDateFin(''); setMotifConge('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitAvance = async () => {
    if (!montantAvance || Number(montantAvance) <= 0) { toast.error('Montant invalide'); return; }
    setSubmitting(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          token: session!.token,
          action: 'demander_avance',
          avance: { montant: Number(montantAvance), motif: motifAvance },
        }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      toast.success('Demande d\'avance envoyée');
      setAvanceOpen(false);
      setMontantAvance(''); setMotifAvance('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  const statutBadge = (s: string) => {
    if (s === 'approuve') return <Badge className="bg-green-500">Approuvé</Badge>;
    if (s === 'refuse') return <Badge variant="destructive">Refusé</Badge>;
    return <Badge variant="secondary">En attente</Badge>;
  };

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2"><Calendar className="h-5 w-5" /> Congés & Avances</h2>
            <div className="flex gap-2">
              <Dialog open={congeOpen} onOpenChange={setCongeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1" /> Congé</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Demande de congé</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={typeConge} onValueChange={setTypeConge}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annuel">Congé annuel</SelectItem>
                          <SelectItem value="maladie">Maladie</SelectItem>
                          <SelectItem value="familial">Événement familial</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Du</Label>
                        <Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Au</Label>
                        <Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Motif</Label>
                      <Textarea value={motifConge} onChange={e => setMotifConge(e.target.value)} placeholder="Raison de la demande..." />
                    </div>
                    <Button className="w-full" onClick={submitConge} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Envoyer la demande
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={avanceOpen} onOpenChange={setAvanceOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><DollarSign className="h-4 w-4 mr-1" /> Avance</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Demande d'avance sur salaire</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Montant (GNF)</Label>
                      <Input type="number" value={montantAvance} onChange={e => setMontantAvance(e.target.value)} placeholder="Ex: 500000" />
                    </div>
                    <div className="space-y-2">
                      <Label>Motif</Label>
                      <Textarea value={motifAvance} onChange={e => setMotifAvance(e.target.value)} placeholder="Raison de la demande..." />
                    </div>
                    <Button className="w-full" onClick={submitAvance} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Envoyer la demande
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Congés list */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Mes demandes de congé</CardTitle></CardHeader>
            <CardContent>
              {(data?.conges || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune demande de congé</p>
              ) : (
                <div className="space-y-3">
                  {data.conges.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="text-sm font-medium capitalize">{c.type_conge}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.date_debut), 'dd MMM yyyy', { locale: fr })} → {format(new Date(c.date_fin), 'dd MMM yyyy', { locale: fr })}
                        </p>
                        {c.motif && <p className="text-xs text-muted-foreground">{c.motif}</p>}
                      </div>
                      {statutBadge(c.statut)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Avances list */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Mes demandes d'avance</CardTitle></CardHeader>
            <CardContent>
              {(data?.avances || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune demande d'avance</p>
              ) : (
                <div className="space-y-3">
                  {data.avances.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="text-sm font-medium">{Number(a.montant).toLocaleString()} GNF</p>
                        {a.motif && <p className="text-xs text-muted-foreground">{a.motif}</p>}
                        <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd MMM yyyy', { locale: fr })}</p>
                      </div>
                      {statutBadge(a.statut)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </EmployeeLayout>
  );
}
