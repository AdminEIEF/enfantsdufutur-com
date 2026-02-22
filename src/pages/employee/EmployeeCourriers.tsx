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
import { Loader2, Plus, Mail, Paperclip, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const COURRIER_TYPES = [
  { value: 'demande', label: 'Demande' },
  { value: 'maladie', label: '🏥 Maladie (justificatif obligatoire)' },
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

  const uploadFile = async (): Promise<{ url: string; nom: string } | null> => {
    if (!fichier || !session) return null;
    const ext = fichier.name.split('.').pop();
    const path = `${session.employe.id}/${Date.now()}.${ext}`;
    
    const formData = new FormData();
    formData.append('file', fichier);

    // Upload via Supabase storage REST API
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/courriers-employes/${path}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: formData,
      }
    );
    if (!resp.ok) {
      toast.error("Erreur lors de l'upload du fichier");
      return null;
    }
    const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/courriers-employes/${path}`;
    return { url: publicUrl, nom: fichier.name };
  };

  const submitCourrier = async () => {
    if (!objet || !contenu) { toast.error('Objet et contenu requis'); return; }
    if (typeCourrier === 'maladie' && !fichier) {
      toast.error('Un justificatif est obligatoire pour un congé maladie');
      return;
    }
    setSubmitting(true);
    try {
      let fichierData: { url: string; nom: string } | null = null;
      if (fichier) {
        fichierData = await uploadFile();
        if (!fichierData && typeCourrier === 'maladie') {
          setSubmitting(false);
          return;
        }
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          token: session!.token,
          action: 'envoyer_courrier',
          courrier: {
            type: typeCourrier,
            objet,
            contenu,
            fichier_url: fichierData?.url || null,
            fichier_nom: fichierData?.nom || null,
          },
        }),
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error);
      toast.success('Courrier envoyé avec succès');
      setSendOpen(false);
      setObjet(''); setContenu(''); setFichier(null); setTypeCourrier('demande');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  const statutBadge = (s: string) => {
    if (s === 'traite') return <Badge className="bg-green-500 text-xs">Traité</Badge>;
    if (s === 'lu') return <Badge variant="secondary" className="text-xs">Lu</Badge>;
    return <Badge variant="outline" className="text-xs">Non lu</Badge>;
  };

  const typeLabel: Record<string, string> = {
    demande: '📩 Demande',
    maladie: '🏥 Maladie',
    plainte: '⚠️ Plainte',
    autre: '📝 Autre',
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
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Mail className="h-5 w-5" /> Mes courriers
            </h2>
            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="h-4 w-4 mr-1" /> Nouveau courrier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Envoyer un courrier</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type de courrier</Label>
                    <Select value={typeCourrier} onValueChange={setTypeCourrier}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COURRIER_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {typeCourrier === 'maladie' && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Un justificatif médical (certificat, ordonnance) est <strong>obligatoire</strong> pour tout courrier de type maladie.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Objet *</Label>
                    <Input value={objet} onChange={e => setObjet(e.target.value)} placeholder="Ex: Demande de congé maladie" />
                  </div>

                  <div className="space-y-2">
                    <Label>Contenu *</Label>
                    <Textarea
                      value={contenu}
                      onChange={e => setContenu(e.target.value)}
                      placeholder="Rédigez votre courrier..."
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Paperclip className="h-3.5 w-3.5" />
                      Pièce jointe {typeCourrier === 'maladie' && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => setFichier(e.target.files?.[0] || null)}
                    />
                    {fichier && (
                      <p className="text-xs text-muted-foreground">
                        📎 {fichier.name} ({(fichier.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>

                  <Button className="w-full" onClick={submitCourrier} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Envoyer le courrier
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {(data?.courriers || []).length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">Aucun courrier envoyé</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.courriers.map((c: any) => (
                <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewCourrier(c)}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{typeLabel[c.type] || c.type}</span>
                          {statutBadge(c.statut)}
                          {c.fichier_url && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <p className="font-medium text-sm truncate">{c.objet}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.contenu}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(c.created_at), 'dd/MM/yy')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* View courrier dialog */}
          <Dialog open={!!viewCourrier} onOpenChange={v => { if (!v) setViewCourrier(null); }}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              {viewCourrier && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {typeLabel[viewCourrier.type]} {statutBadge(viewCourrier.statut)}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Objet</p>
                      <p className="font-medium">{viewCourrier.objet}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Contenu</p>
                      <p className="text-sm whitespace-pre-wrap">{viewCourrier.contenu}</p>
                    </div>
                    {viewCourrier.fichier_url && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Pièce jointe</p>
                        <Button size="sm" variant="outline" onClick={() => window.open(viewCourrier.fichier_url, '_blank')}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> {viewCourrier.fichier_nom || 'Voir le fichier'}
                        </Button>
                      </div>
                    )}
                    {viewCourrier.reponse && (
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Réponse de l'administration</p>
                        <p className="text-sm">{viewCourrier.reponse}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Envoyé le {format(new Date(viewCourrier.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}
    </EmployeeLayout>
  );
}
