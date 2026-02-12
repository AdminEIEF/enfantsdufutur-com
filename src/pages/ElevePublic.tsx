import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, User, CheckCircle2, XCircle, GraduationCap } from 'lucide-react';

function useEleveByMatricule(matricule: string) {
  return useQuery({
    queryKey: ['eleve-public', matricule],
    enabled: !!matricule,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, sexe, date_naissance, photo_url, statut, classe_id, classes(nom, niveaux(nom, cycles(nom)))')
        .eq('matricule', matricule)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function usePaiementsEleve(eleveId: string) {
  return useQuery({
    queryKey: ['paiements-public', eleveId],
    enabled: !!eleveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('*')
        .eq('eleve_id', eleveId)
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export default function ElevePublic() {
  const { matricule } = useParams<{ matricule: string }>();
  const { data: eleve, isLoading, error } = useEleveByMatricule(matricule || '');
  const { data: paiements = [] } = usePaiementsEleve(eleve?.id || '');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !eleve) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive opacity-50" />
            <h2 className="text-xl font-bold mb-2">Élève introuvable</h2>
            <p className="text-muted-foreground">Aucun élève trouvé avec le matricule <strong>{matricule}</strong></p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const classe = (eleve as any).classes;
  const totalPaye = paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                {eleve.photo_url ? (
                  <img src={eleve.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{eleve.prenom} {eleve.nom}</h1>
                <p className="text-muted-foreground flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  {classe?.niveaux?.cycles?.nom} — {classe?.niveaux?.nom} — {classe?.nom}
                </p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">Matricule: {eleve.matricule}</Badge>
                  {eleve.sexe && <Badge variant="secondary">{eleve.sexe}</Badge>}
                  <Badge className={eleve.statut === 'inscrit' ? 'bg-green-600' : 'bg-orange-500'}>{eleve.statut}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Résumé paiements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Historique des paiements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border">
              <p className="text-sm text-muted-foreground">Total payé</p>
              <p className="text-2xl font-bold text-primary">{totalPaye.toLocaleString()} GNF</p>
            </div>

            {paiements.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Aucun paiement enregistré</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mois</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiements.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell><Badge variant="outline">{p.type_paiement}</Badge></TableCell>
                      <TableCell>{p.mois_concerne || '—'}</TableCell>
                      <TableCell>{p.canal}</TableCell>
                      <TableCell className="text-right font-medium">{Number(p.montant).toLocaleString()} GNF</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
