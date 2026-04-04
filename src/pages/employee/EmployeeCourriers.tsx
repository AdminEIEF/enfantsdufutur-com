import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmployeeLayout } from '@/components/EmployeeLayout';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Loader2, Plus, Mail, Paperclip, Eye, AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const COURRIER_TYPES = [
  { value: 'demande', label: 'Demande' },
  { value: 'maladie', label: '🏥 Maladie' },
  { value: 'plainte', label: 'Plainte' },
  { value: 'autre', label: 'Autre' },
];

export default function EmployeeCourriers() {
  const { session } = useEmployeeAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewCourrier, setViewCourrier] = useState<any>(null);
  const [typeCourrier, setTypeCourrier] = useState('demande');
  const [objet, setObjet] = useState('');
  const [contenu, setContenu] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);

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

  const uploadFile = async (): Promise<{ url: string; nom: string } | null> => {
    if (!fichier || !session) return null;
    const ext = fichier.name.split('.').pop();
    const path = `${session.employe.id}/${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('file', fichier);
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/courriers-employes/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: formData,
    });
    if (!resp.ok) { toast.error("Erreur upload"); return null; }
    return { url: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/courriers-employes/${path}`, nom: fichier.name };
  };

  const submitCourrier = async () => {
    if (!objet || !contenu) { toast.error('Champs requis'); return; }
    if (typeCourrier === 'maladie' && !fichier) { toast.error('Justificatif obligatoire'); return; }
    setSubmitting(true);
    try {
      let fichierData: any = null;
      if (fichier) { fichierData = await uploadFile(); if (!fichierData && typeCourrier === 'maladie') { setSubmitting(false); return; } }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session!.token, action: 'envoyer_courrier', courrier: { type: typeCourrier, objet, contenu, fichier_url: fichierData?.url || null, fichier_nom: fichierData?.nom || null } }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      toast.success('Courrier envoyé'); setSendOpen(false); setObjet(''); setContenu(''); setFichier(null); fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  if (!session) return null;

  const statutPill = (s: string) => {
    const cls = s === 'traite' ? 'bg-emerald-500/10 text-emerald-600' : s === 'lu' ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground';
    const label = s === 'traite' ? 'Traité' : s === 'lu' ? 'Lu' : 'Non lu';
    return <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${cls}`}>{label}</span>;
  };

  const typeEmoji: Record<string, string> = { demande: '📩', maladie: '🏥', plainte: '⚠️', autre: '📝' };

  return (
    <EmployeeLayout>
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <Mail className="h-4.5 w-4.5 text-pink-500" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Mes courriers</h2>
            </div>
            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/15 text-xs h-9 px-3">
                  <Send className="h-3.5 w-3.5 mr-1" /> Nouveau
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Envoyer un courrier</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={typeCourrier} onValueChange={setTypeCourrier}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COURRIER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {typeCourrier === 'maladie' && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">Justificatif <strong>obligatoire</strong></p>
                    </div>
                  )}
                  <div className="space-y-1.5"><Label className="text-xs">Objet *</Label><Input value={objet} onChange={e => setObjet(e.target.value)} className="rounded-xl" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Contenu *</Label><Textarea value={contenu} onChange={e => setContenu(e.target.value)} rows={5} className="rounded-xl" /></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Pièce jointe</Label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => setFichier(e.target.files?.[0] || null)} className="rounded-xl" />
                  </div>
                  <Button className="w-full rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700" onClick={submitCourrier} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Envoyer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>

          {(data?.courriers || []).length === 0 ? (
            <div className="rounded-2xl bg-card border border-border/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">Aucun courrier</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="rounded-2xl bg-card border border-border/40 overflow-hidden divide-y divide-border/30">
                {data.courriers.map((c: any) => (
                  <button key={c.id} onClick={() => setViewCourrier(c)} className="w-full text-left px-4 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{typeEmoji[c.type] || '📝'}</span>
                          {statutPill(c.statut)}
                          {c.fichier_url && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <p className="font-medium text-sm text-foreground truncate">{c.objet}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{c.contenu}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-1">{format(new Date(c.created_at), 'dd/MM/yy')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* View dialog */}
          <Dialog open={!!viewCourrier} onOpenChange={v => { if (!v) setViewCourrier(null); }}>
            <DialogContent className="rounded-2xl max-w-lg max-h-[80vh] overflow-y-auto">
              {viewCourrier && (
                <div className="space-y-4">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {typeEmoji[viewCourrier.type]} {viewCourrier.objet}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex items-center gap-2">
                    {statutPill(viewCourrier.statut)}
                    <span className="text-xs text-muted-foreground">{format(new Date(viewCourrier.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-foreground">{viewCourrier.contenu}</p>
                  {viewCourrier.fichier_url && (
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.open(viewCourrier.fichier_url, '_blank')}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> {viewCourrier.fichier_nom || 'Voir le fichier'}
                    </Button>
                  )}
                  {viewCourrier.reponse && (
                    <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
                      <p className="text-[10px] text-muted-foreground mb-1">Réponse de l'administration</p>
                      <p className="text-sm text-foreground">{viewCourrier.reponse}</p>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </EmployeeLayout>
  );
}
