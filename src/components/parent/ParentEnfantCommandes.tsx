import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Package, Download, ShoppingBag } from 'lucide-react';
import { generateBonRecuperation } from '@/lib/generateBonRecuperation';

interface Props {
  commandesArticles: any[];
  enfant: any;
}

export default function ParentEnfantCommandes({ commandesArticles, enfant }: Props) {
  const commandesPaye = commandesArticles.filter((c: any) => c.statut === 'paye');
  const commandesLivrees = commandesArticles.filter((c: any) => c.statut === 'livre');

  const totalPaye = commandesPaye.reduce((s: number, c: any) => s + Number(c.prix_unitaire) * c.quantite, 0);
  const totalLivre = commandesLivrees.reduce((s: number, c: any) => s + Number(c.prix_unitaire) * c.quantite, 0);

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
      totalMontant: totalLivre,
      date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      heure: commandesLivrees[0]?.livre_at
        ? new Date(commandesLivrees[0].livre_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  if (commandesArticles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucune commande d'articles enregistrée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-center">
          <ShoppingBag className="h-5 w-5 mx-auto text-orange-500 mb-1" />
          <p className="text-lg font-bold text-orange-700">{commandesPaye.length}</p>
          <p className="text-[11px] text-orange-600">En attente</p>
          {totalPaye > 0 && <p className="text-xs font-semibold text-orange-800 mt-1">{totalPaye.toLocaleString()} F</p>}
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
          <p className="text-lg font-bold text-green-700">{commandesLivrees.length}</p>
          <p className="text-[11px] text-green-600">Récupérés</p>
          {totalLivre > 0 && <p className="text-xs font-semibold text-green-800 mt-1">{totalLivre.toLocaleString()} F</p>}
        </div>
      </div>

      {/* En attente */}
      {commandesPaye.length > 0 && (
        <Card className="border-orange-200 overflow-hidden">
          <CardHeader className="pb-2 px-3 pt-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-orange-700 uppercase tracking-wide">
              <Clock className="h-3.5 w-3.5" /> En attente de retrait
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Articles payés à récupérer à la boutique.
            </p>
            {commandesPaye.map((c: any) => (
              <div key={c.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-orange-100 bg-orange-50/60">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.article_nom}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                    {c.article_taille && <span>Taille: {c.article_taille}</span>}
                    <span>Qté: {c.quantite}</span>
                    <span className="font-medium text-orange-700">{(Number(c.prix_unitaire) * c.quantite).toLocaleString()} F</span>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-[10px] shrink-0 whitespace-nowrap">
                  <Clock className="h-3 w-3 mr-0.5" /> Payé
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Livrés */}
      {commandesLivrees.length > 0 && (
        <Card className="border-green-200 overflow-hidden">
          <CardHeader className="pb-2 px-3 pt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-green-700 uppercase tracking-wide">
                <CheckCircle2 className="h-3.5 w-3.5" /> Récupérés
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleDownloadBon} className="text-[11px] h-7 px-2 gap-1">
                <Download className="h-3 w-3" /> Bon
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            {commandesLivrees.map((c: any) => (
              <div key={c.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-green-100 bg-green-50/60">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.article_nom}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                    {c.article_taille && <span>Taille: {c.article_taille}</span>}
                    <span>Qté: {c.quantite}</span>
                    <span className="font-medium text-green-700">{(Number(c.prix_unitaire) * c.quantite).toLocaleString()} F</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="default" className="bg-green-600 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> OK
                  </Badge>
                  {c.livre_at && (
                    <p className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                      {new Date(c.livre_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
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
