import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const [activeTab, setActiveTab] = useState('pointage');

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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 relative">
      <SchoolWatermark />
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
          <>
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: 'pointage', label: 'Présence', icon: ScanLine, color: 'bg-blue-500', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
                { key: 'devoirs', label: 'Devoirs', icon: ClipboardList, color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', badge: devoirsEnAttente.length },
                { key: 'emploi', label: 'Emploi', icon: Calendar, color: 'bg-emerald-500', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50' },
                { key: 'commandes', label: 'Commandes', icon: Package, color: 'bg-purple-500', textColor: 'text-purple-700', bgLight: 'bg-purple-50' },
                { key: 'cantine', label: 'Cantine', icon: UtensilsCrossed, color: 'bg-rose-500', textColor: 'text-rose-700', bgLight: 'bg-rose-50' },
                { key: 'fournitures', label: 'Achats', icon: BookOpen, color: 'bg-amber-500', textColor: 'text-amber-700', bgLight: 'bg-amber-50' },
                { key: 'bulletins', label: 'Bulletins', icon: FileText, color: 'bg-teal-500', textColor: 'text-teal-700', bgLight: 'bg-teal-50' },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`relative flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all duration-200 active:scale-95 ${
                      isActive
                        ? `${item.bgLight} ring-2 ring-offset-1 ring-current ${item.textColor} shadow-sm`
                        : 'bg-card hover:bg-muted/60'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isActive ? item.color : 'bg-muted'} transition-colors`}>
                      <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`text-[11px] font-medium leading-tight text-center ${isActive ? item.textColor : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                    {item.badge && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              {activeTab === 'pointage' && <ParentEnfantPointage pointages={data?.pointages || []} />}
              {activeTab === 'devoirs' && <ParentEnfantDevoirs devoirs={devoirs} soumissions={soumissions} />}
              {activeTab === 'emploi' && <ParentEnfantEmploiDuTemps emploiDuTemps={data?.emploiDuTemps || []} />}
              {activeTab === 'commandes' && (
                <ParentEnfantCommandes commandesArticles={data?.commandesArticles || []} enfant={enfant} />
              )}
              {activeTab === 'cantine' && (
                <ParentEnfantCantine repas={data?.repas || []} soldeCantine={data?.solde_cantine ?? enfant.solde_cantine ?? 0} />
              )}
              {activeTab === 'fournitures' && (
                <ParentEnfantFournitures
                  articlesNiveau={data?.articlesNiveau || []}
                  ventesArticles={data?.ventesArticles || []}
                  boutiqueVentes={data?.boutiqueVentes || []}
                />
              )}
              {activeTab === 'bulletins' && <ParentEnfantBulletins bulletinPublications={data?.bulletinPublications || []} />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
