import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { ClipboardList, Upload, CheckCircle, Clock, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export default function StudentDevoirs() {
  const { session } = useStudentAuth();
  const [devoirs, setDevoirs] = useState<any[]>([]);
  const [soumissions, setSoumissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevoirId, setSelectedDevoirId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchDevoirs();
  }, [session]);

  const fetchDevoirs = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ matricule: session!.matricule, password: session!.token, action: 'devoirs' }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setDevoirs(data.devoirs || []);
      setSoumissions(data.soumissions || []);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (devoirId: string, file: File) => {
    if (!file || !session) return;
    const ext = file.name.split('.').pop();
    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    if (!allowed.includes(ext?.toLowerCase() || '')) {
      toast.error('Format autorisé : PDF, JPG, PNG');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setUploading(devoirId);
    try {
      const fileName = `${session.eleve.id}/${devoirId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('devoirs').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('devoirs').getPublicUrl(fileName);

      // Insert submission via edge function would require admin, so use direct insert
      // Since RLS allows authenticated reads only, we use the edge function approach
      // For now, we'll call a simple submission endpoint
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            token: session.token,
            devoir_id: devoirId,
            fichier_url: publicUrl,
            fichier_nom: file.name,
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      toast.success('Devoir soumis avec succès !');
      fetchDevoirs();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setUploading(null);
    }
  };

  const aFaire = devoirs.filter(d => !isPast(new Date(d.date_limite)) && !soumissions.find(s => s.devoir_id === d.id));
  const soumis = devoirs.filter(d => soumissions.find(s => s.devoir_id === d.id));
  const expires = devoirs.filter(d => isPast(new Date(d.date_limite)) && !soumissions.find(s => s.devoir_id === d.id));

  const renderDevoir = (d: any, canSubmit: boolean) => {
    const soumission = soumissions.find(s => s.devoir_id === d.id);
    const isExpired = isPast(new Date(d.date_limite));

    return (
      <Card key={d.id}>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{d.titre}</p>
              <p className="text-xs text-muted-foreground">{d.matieres?.nom}</p>
              {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
            </div>
            {soumission ? (
              <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Soumis</Badge>
            ) : isExpired ? (
              <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Expiré</Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <Clock className="h-3 w-3 mr-1" />
                {formatDistanceToNow(new Date(d.date_limite), { addSuffix: true, locale: fr })}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Date limite : {new Date(d.date_limite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>Note max : {d.note_max}</span>
          </div>

          {soumission ? (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 space-y-1">
              <p className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <a href={soumission.fichier_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{soumission.fichier_nom}</a>
              </p>
              {soumission.note !== null && (
                <p className="text-sm font-semibold">Note : {soumission.note}/{d.note_max}</p>
              )}
              {soumission.commentaire && (
                <p className="text-xs text-muted-foreground">💬 {soumission.commentaire}</p>
              )}
            </div>
          ) : canSubmit ? (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && selectedDevoirId) handleUpload(selectedDevoirId, file);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                disabled={!!uploading}
                onClick={() => {
                  setSelectedDevoirId(d.id);
                  fileInputRef.current?.click();
                }}
              >
                {uploading === d.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Soumettre mon travail
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <StudentLayout>
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-orange-600" /> Mes devoirs
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <Tabs defaultValue="afaire">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="afaire">À faire ({aFaire.length})</TabsTrigger>
            <TabsTrigger value="soumis">Soumis ({soumis.length})</TabsTrigger>
            <TabsTrigger value="expires">Expirés ({expires.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="afaire" className="space-y-3 mt-4">
            {aFaire.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucun devoir en cours 🎉</p> : aFaire.map(d => renderDevoir(d, true))}
          </TabsContent>
          <TabsContent value="soumis" className="space-y-3 mt-4">
            {soumis.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucune soumission</p> : soumis.map(d => renderDevoir(d, false))}
          </TabsContent>
          <TabsContent value="expires" className="space-y-3 mt-4">
            {expires.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucun devoir expiré</p> : expires.map(d => renderDevoir(d, false))}
          </TabsContent>
        </Tabs>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
