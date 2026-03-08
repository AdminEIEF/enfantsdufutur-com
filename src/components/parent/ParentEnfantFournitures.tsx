import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, BookOpen, ShoppingBag } from 'lucide-react';

interface Props {
  articlesNiveau: any[];
  ventesArticles: any[];
  boutiqueVentes: any[];
}

export default function ParentEnfantFournitures({ articlesNiveau, ventesArticles, boutiqueVentes }: Props) {
  const articlesAchetes = new Set(ventesArticles.map((v: any) => v.article_id));
  const librairieFull = articlesNiveau.length > 0 && articlesNiveau.every((a: any) => articlesAchetes.has(a.id));

  const allBoutiqueItems = boutiqueVentes.flatMap((v: any) =>
    (v.boutique_vente_items || []).map((item: any) => ({ ...item, date: v.created_at }))
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Librairie / Fournitures
          </h3>
          <Badge variant={librairieFull ? 'default' : 'secondary'} className={librairieFull ? 'bg-green-600' : ''}>
            {librairieFull ? 'Complet' : 'Partiel'}
          </Badge>
        </div>
        {articlesNiveau.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun article prévu pour ce niveau</p>
        ) : (
          <div className="space-y-1">
            {articlesNiveau.map((article: any) => {
              const acheté = articlesAchetes.has(article.id);
              return (
                <div key={article.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border">
                  {acheté ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Clock className="h-4 w-4 text-orange-500 shrink-0" />}
                  <span className="text-sm flex-1">{article.nom}</span>
                  <Badge variant="outline" className="text-xs">{article.categorie}</Badge>
                  <span className="text-xs text-muted-foreground">{acheté ? 'Récupéré' : 'En attente'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" /> Boutique / Uniformes
        </h3>
        {allBoutiqueItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun achat en boutique</p>
        ) : (
          <div className="space-y-1">
            {allBoutiqueItems.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm flex-1">
                  {item.boutique_articles?.nom || 'Article'}
                  {item.boutique_articles?.taille && item.boutique_articles.taille !== 'unique' && ` (${item.boutique_articles.taille})`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
