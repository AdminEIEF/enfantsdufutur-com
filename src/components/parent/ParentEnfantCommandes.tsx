import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Package, Download } from 'lucide-react';
import { generateBonRecuperation } from '@/lib/generateBonRecuperation';

interface Props {
  commandesArticles: any[];
  enfant: any;
}

export default function ParentEnfantCommandes({ commandesArticles, enfant }: Props) {
  const commandesPaye = commandesArticles.filter((c: any) => c.statut === 'paye');
  const commandesLivrees = commandesArticles.filter((c: any) => c.statut === 'livre');

  const handleDownloadBon = () => {
    if (commandesLivrees.length === 0) return;
    const now = new Date();
    generateBonRecuperation({
      eleve: `${enfant.prenom} ${enfant.nom}`,
      matricule: enfant.matricule || '',
      classe: enfant.classes?.nom || '—',
      articles: commandesLivrees.map((c: any) => ({
        nom: c.article_nom,
        taille: c.article_taille,
        quantite: c.quantite,
        prixUnitaire: Number(c.prix_unitaire),
      })),
      totalMontant: commandesLivrees.reduce((s: number, c: any) => s + Number(c.prix_unitaire) * c.quantite, 0),
      date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      heure: commandesLivrees[0]?.livre_at
        ? new Date(commandesLivrees[0].livre_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  if (commandesArticles.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center text-muted-foreground">
        <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Aucune commande d'articles enregistrée</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {commandesPaye.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
              <Clock className="h-4 w-4" /> En attente de retrait ({commandesPaye.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">
              Ces articles sont payés et peuvent être récupérés à la boutique de l'école.
            </p>
            {commandesPaye.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border bg-orange-50/50">
                <div>
                  <p className="text-sm font-medium">{c.article_nom}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.article_taille && <span>Taille: {c.article_taille}</span>}
                    <span>Qté: {c.quantite}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                  <Clock className="h-3 w-3 mr-1" /> Payé
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {commandesLivrees.length > 0 && (
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Livrés ({commandesLivrees.length})
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleDownloadBon} className="text-xs gap-1">
                <Download className="h-3 w-3" /> Bon de Récupération
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {commandesLivrees.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border bg-green-50/50">
                <div>
                  <p className="text-sm font-medium">{c.article_nom}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {c.article_taille && <span>Taille: {c.article_taille}</span>}
                    <span>Qté: {c.quantite}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="default" className="bg-green-600 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Récupéré
                  </Badge>
                  {c.livre_at && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      📅 {new Date(c.livre_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' à '}{new Date(c.livre_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
