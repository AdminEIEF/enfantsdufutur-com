import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Plus, Calendar, DollarSign, Palmtree, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function EmployeeConges() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [congeOpen, setCongeOpen] = useState(false);
  const [avanceOpen, setAvanceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [typeConge, setTypeConge] = useState('annuel');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motifConge, setMotifConge] = useState('');
  const [montantAvance, setMontantAvance] = useState('');
  const [motifAvance, setMotifAvance] = useState('');

  const fetchData = () => {
    if (!session) return;
    setLoading(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session.token, action: 'dashboard' }),
    }).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(fetchData, [session]);

  const submitConge = async () => {
    if (!dateDebut || !dateFin) { toast.error('Dates requises'); return; }
    setSubmitting(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session!.token, action: 'demander_conge', conge: { type_conge: typeConge, date_debut: dateDebut, date_fin: dateFin, motif: motifConge } }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      toast.success('Demande envoyée'); setCongeOpen(false); setDateDebut(''); setDateFin(''); setMotifConge(''); fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const submitAvance = async () => {
    if (!montantAvance || Number(montantAvance) <= 0) { toast.error('Montant invalide'); return; }
    setSubmitting(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session!.token, action: 'demander_avance', avance: { montant: Number(montantAvance), motif: motifAvance } }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      toast.success('Demande envoyée'); setAvanceOpen(false); setMontantAvance(''); setMotifAvance(''); fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  if (!session) return null;

  const statutPill = (s: string, motif?: string) => {
    const cls = s === 'approuve' ? 'bg-emerald-500/10 text-emerald-600' : s === 'rembourse' ? 'bg-blue-500/10 text-blue-600' : s === 'refuse' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10 text-amber-600';
    const label = s === 'approuve' ? 'Approuvé' : s === 'rembourse' ? 'Remboursé' : s === 'refuse' ? 'Refusé' : 'En attente';
    return (
      <div className="text-right">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
        {s === 'refuse' && motif && <p className="text-[9px] text-destructive mt-0.5 max-w-28">{motif}</p>}
      </div>
    );
  };

  const fmtNum = (n: number) => n.toLocaleString();

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Calendar className="h-4.5 w-4.5 text-emerald-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Congés & Avances</h2>
            </div>
            <div className="flex gap-2">
              <Dialog open={congeOpen} onOpenChange={setCongeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/15 text-xs h-9 px-3">
                    <Palmtree className="h-3.5 w-3.5 mr-1" /> Congé
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader><DialogTitle>Demande de congé</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={typeConge} onValueChange={setTypeConge}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annuel">Congé annuel</SelectItem>
                          <SelectItem value="maladie">Maladie</SelectItem>
                          <SelectItem value="familial">Événement familial</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label className="text-xs">Du</Label><Input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className="rounded-xl" /></div>
                      <div className="space-y-1.5"><Label className="text-xs">Au</Label><Input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className="rounded-xl" /></div>
                    </div>
                    <div className="space-y-1.5"><Label className="text-xs">Motif</Label><Textarea value={motifConge} onChange={e => setMotifConge(e.target.value)} placeholder="Raison..." className="rounded-xl" /></div>
                    <Button className="w-full rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700" onClick={submitConge} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Envoyer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={avanceOpen} onOpenChange={setAvanceOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-xl text-xs h-9 px-3">
                    <Banknote className="h-3.5 w-3.5 mr-1" /> Avance
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader><DialogTitle>Demande d'avance</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-1.5"><Label className="text-xs">Montant (GNF)</Label><Input type="number" value={montantAvance} onChange={e => setMontantAvance(e.target.value)} placeholder="500000" className="rounded-xl" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Motif</Label><Textarea value={motifAvance} onChange={e => setMotifAvance(e.target.value)} placeholder="Raison..." className="rounded-xl" /></div>
                    <Button className="w-full rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700" onClick={submitAvance} disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Envoyer
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </motion.div>

          {/* Congés */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <Palmtree className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-foreground">Mes congés</h3>
              </div>
              {(data?.conges || []).length === 0 ? (
                <div className="px-4 pb-4"><p className="text-sm text-muted-foreground text-center py-6">Aucune demande</p></div>
              ) : (
                <div className="divide-y divide-border/30">
                  {data.conges.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{c.type_conge}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(c.date_debut), 'dd MMM', { locale: fr })} → {format(new Date(c.date_fin), 'dd MMM yyyy', { locale: fr })}
                        </p>
                        {c.motif && <p className="text-[10px] text-muted-foreground mt-0.5">{c.motif}</p>}
                      </div>
                      {statutPill(c.statut, c.motif)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Avances */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="rounded-2xl bg-card border border-border/40 overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <DollarSign className="h-4 w-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-foreground">Mes avances</h3>
              </div>
              {(data?.avances || []).length === 0 ? (
                <div className="px-4 pb-4"><p className="text-sm text-muted-foreground text-center py-6">Aucune demande</p></div>
              ) : (
                <div className="divide-y divide-border/30">
                  {data.avances.map((a: any) => {
                    const restant = Number(a.montant) - Number(a.montant_rembourse || 0);
                    return (
                      <div key={a.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{fmtNum(Number(a.montant))} GNF</p>
                          {a.statut === 'approuve' && restant > 0 && (
                            <p className="text-[10px] text-amber-600">Restant: {fmtNum(restant)} GNF</p>
                          )}
                          {a.motif && <p className="text-[10px] text-muted-foreground">{a.motif}</p>}
                          <p className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), 'dd MMM yyyy', { locale: fr })}</p>
                        </div>
                        {statutPill(a.statut)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </EmployeeLayout>
  );
}
