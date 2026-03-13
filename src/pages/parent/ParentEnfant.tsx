import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useParentAuth } from '@/hooks/useParentAuth';
import {
  ArrowLeft, UtensilsCrossed, BookOpen, ShoppingBag, FileText,
  Loader2, CheckCircle2, Clock, Package, Download, ClipboardList, Calendar, ScanLine
} from 'lucide-react';
import { toast } from 'sonner';
import { generateBonRecuperation } from '@/lib/generateBonRecuperation';
import { SchoolWatermark } from '@/components/SchoolWatermark';
import ParentEnfantCommandes from '@/components/parent/ParentEnfantCommandes';
import ParentEnfantCantine from '@/components/parent/ParentEnfantCantine';
import ParentEnfantFournitures from '@/components/parent/ParentEnfantFournitures';
import ParentEnfantBulletins from '@/components/parent/ParentEnfantBulletins';
import ParentEnfantDevoirs from '@/components/parent/ParentEnfantDevoirs';
import ParentEnfantEmploiDuTemps from '@/components/parent/ParentEnfantEmploiDuTemps';
import ParentEnfantPointage from '@/components/parent/ParentEnfantPointage';

export default function ParentEnfant() {
  const { id } = useParams<{ id: string }>();
  const { session, logout } = useParentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const enfant = session?.eleves.find((e) => e.id === id);

  useEffect(() => {
    if (!session || !id) return;
    fetchEnfantData();
  }, [session, id]);

  const fetchEnfantData = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ code: session!.token, action: 'enfant', eleve_id: id }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) { logout(); navigate('/parent', { replace: true }); return; }
        throw new Error(result.error);
      }
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  if (!session || !enfant) {
    navigate('/parent', { replace: true });
    return null;
  }

  const devoirs = data?.devoirs || [];
  const soumissions = data?.soumissions || [];
  const devoirsEnAttente = devoirs.filter((d: any) => {
    const soumis = soumissions.find((s: any) => s.devoir_id === d.id);
    return !soumis && new Date(d.date_limite) >= new Date();
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/parent/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            {enfant.photo_url ? (
              <img src={enfant.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {enfant.prenom[0]}{enfant.nom[0]}
              </div>
            )}
            <div>
              <h1 className="font-bold text-sm leading-tight">{enfant.prenom} {enfant.nom}</h1>
              <p className="text-xs text-muted-foreground">
                {enfant.classes?.niveaux?.cycles?.nom} — {enfant.classes?.niveaux?.nom} — {enfant.classes?.nom}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="pointage">
            <TabsList className="w-full grid grid-cols-4 sm:grid-cols-7">
              <TabsTrigger value="pointage">
                <ScanLine className="h-4 w-4 mr-1" /> Présence
              </TabsTrigger>
              <TabsTrigger value="devoirs">
                <ClipboardList className="h-4 w-4 mr-1" /> Devoirs
                {devoirsEnAttente.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs h-5 px-1.5">{devoirsEnAttente.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="emploi">
                <Calendar className="h-4 w-4 mr-1" /> Emploi
              </TabsTrigger>
              <TabsTrigger value="commandes">
                <Package className="h-4 w-4 mr-1" /> Commandes
              </TabsTrigger>
              <TabsTrigger value="cantine">
                <UtensilsCrossed className="h-4 w-4 mr-1" /> Cantine
              </TabsTrigger>
              <TabsTrigger value="fournitures">
                <BookOpen className="h-4 w-4 mr-1" /> Achats
              </TabsTrigger>
              <TabsTrigger value="bulletins">
                <FileText className="h-4 w-4 mr-1" /> Bulletins
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pointage" className="mt-4">
              <ParentEnfantPointage pointages={data?.pointages || []} />
            </TabsContent>

            <TabsContent value="devoirs" className="mt-4">
              <ParentEnfantDevoirs devoirs={devoirs} soumissions={soumissions} />
            </TabsContent>

            <TabsContent value="emploi" className="mt-4">
              <ParentEnfantEmploiDuTemps emploiDuTemps={data?.emploiDuTemps || []} />
            </TabsContent>

            <TabsContent value="commandes" className="mt-4">
              <ParentEnfantCommandes
                commandesArticles={data?.commandesArticles || []}
                enfant={enfant}
              />
            </TabsContent>

            <TabsContent value="cantine" className="mt-4">
              <ParentEnfantCantine
                repas={data?.repas || []}
                soldeCantine={data?.solde_cantine ?? enfant.solde_cantine ?? 0}
              />
            </TabsContent>

            <TabsContent value="fournitures" className="mt-4">
              <ParentEnfantFournitures
                articlesNiveau={data?.articlesNiveau || []}
                ventesArticles={data?.ventesArticles || []}
                boutiqueVentes={data?.boutiqueVentes || []}
              />
            </TabsContent>

            <TabsContent value="bulletins" className="mt-4">
              <ParentEnfantBulletins bulletinPublications={data?.bulletinPublications || []} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
