import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useParentAuth } from '@/hooks/useParentAuth';
import {
  ArrowLeft, UtensilsCrossed, BookOpen, ShoppingBag, FileText,
  Loader2, CheckCircle2, Clock, Package, Download, ClipboardList, Calendar, ScanLine, BarChart3,
  GraduationCap, Bus
} from 'lucide-react';
import { toast } from 'sonner';
import { SchoolWatermark } from '@/components/SchoolWatermark';
import ParentEnfantCommandes from '@/components/parent/ParentEnfantCommandes';
import ParentEnfantCantine from '@/components/parent/ParentEnfantCantine';
import ParentEnfantFournitures from '@/components/parent/ParentEnfantFournitures';
import ParentEnfantBulletins from '@/components/parent/ParentEnfantBulletins';
import ParentEnfantDevoirs from '@/components/parent/ParentEnfantDevoirs';
import ParentEnfantEmploiDuTemps from '@/components/parent/ParentEnfantEmploiDuTemps';
import ParentEnfantPointage from '@/components/parent/ParentEnfantPointage';
import ParentEnfantProfilRadar from '@/components/parent/ParentEnfantProfilRadar';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { key: 'pointage', label: 'Présence', icon: ScanLine, gradient: 'from-blue-500 to-blue-600', emoji: '📍' },
  { key: 'devoirs', label: 'Devoirs', icon: ClipboardList, gradient: 'from-orange-500 to-amber-600', emoji: '📝' },
  { key: 'emploi', label: 'Emploi', icon: Calendar, gradient: 'from-emerald-500 to-green-600', emoji: '📅' },
  { key: 'commandes', label: 'Commandes', icon: Package, gradient: 'from-purple-500 to-violet-600', emoji: '📦' },
  { key: 'cantine', label: 'Cantine', icon: UtensilsCrossed, gradient: 'from-rose-500 to-pink-600', emoji: '🍽️' },
  { key: 'bulletins', label: 'Bulletins', icon: FileText, gradient: 'from-teal-500 to-cyan-600', emoji: '🎓' },
  { key: 'profil', label: 'Profil', icon: BarChart3, gradient: 'from-indigo-500 to-blue-600', emoji: '📊' },
];

export default function ParentEnfant() {
  const { id } = useParams<{ id: string }>();
  const { session, logout } = useParentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pointage');
  const { data: schoolConfig } = useSchoolConfig();

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

  const activeTabData = TABS.find(t => t.key === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background relative">
      <SchoolWatermark />

      {/* ─── Premium Header with child photo ─── */}
      <header className="sticky top-0 z-30">
        <div className="bg-gradient-to-br from-primary via-primary/95 to-accent relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/parent/dashboard')} className="text-primary-foreground hover:bg-primary-foreground/10 rounded-xl h-9 w-9 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {enfant.photo_url ? (
                  <img src={enfant.photo_url} alt="" loading="lazy" decoding="async" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-primary-foreground/30 shadow-lg shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-primary-foreground/15 flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0 shadow-lg">
                    {enfant.prenom[0]}{enfant.nom[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-extrabold text-base text-primary-foreground leading-tight truncate">{enfant.prenom} {enfant.nom}</h1>
                  <p className="text-[11px] text-primary-foreground/60 truncate font-medium">
                    {enfant.classes?.niveaux?.cycles?.nom} • {enfant.classes?.niveaux?.nom} • {enfant.classes?.nom}
                  </p>
                  <div className="flex gap-1.5 mt-1">
                    {enfant.option_cantine && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-[9px] font-medium">
                        <UtensilsCrossed className="h-2.5 w-2.5" /> {(enfant.solde_cantine || 0).toLocaleString()}
                      </span>
                    )}
                    {enfant.zone_transport_id && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/10 text-primary-foreground text-[9px] font-medium">
                        <Bus className="h-2.5 w-2.5" /> Transport
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ─── Navigation Grid – Material 3 style ─── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-2">
              {TABS.map((item, i) => {
                const isActive = activeTab === item.key;
                const badgeCount = item.key === 'devoirs' ? devoirsEnAttente.length : 0;
                return (
                  <motion.button
                    key={item.key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => setActiveTab(item.key)}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl p-2.5 transition-all duration-200 active:scale-95 ${
                      isActive
                        ? 'bg-card shadow-lg ring-2 ring-primary/30'
                        : 'bg-card/60 hover:bg-card hover:shadow-sm'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                      isActive ? `bg-gradient-to-br ${item.gradient} shadow-md` : 'bg-muted'
                    }`}>
                      <span className="text-lg">{item.emoji}</span>
                    </div>
                    <span className={`text-[10px] font-semibold leading-tight text-center transition-colors ${
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div layoutId="activeIndicator" className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-primary" />
                    )}
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                        {badgeCount}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>

            {/* ─── Active Section Title ─── */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${activeTabData?.gradient} flex items-center justify-center shadow-sm`}>
                <span className="text-sm">{activeTabData?.emoji}</span>
              </div>
              <h2 className="font-bold text-sm">{activeTabData?.label}</h2>
            </motion.div>

            {/* ─── Tab Content ─── */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'pointage' && <ParentEnfantPointage pointages={data?.pointages || []} />}
                {activeTab === 'devoirs' && <ParentEnfantDevoirs devoirs={devoirs} soumissions={soumissions} />}
                {activeTab === 'emploi' && <ParentEnfantEmploiDuTemps emploiDuTemps={data?.emploiDuTemps || []} />}
                {activeTab === 'commandes' && <ParentEnfantCommandes commandesArticles={data?.commandesArticles || []} enfant={enfant} />}
                {activeTab === 'cantine' && <ParentEnfantCantine repas={data?.repas || []} soldeCantine={data?.solde_cantine ?? enfant.solde_cantine ?? 0} />}
                {activeTab === 'fournitures' && <ParentEnfantFournitures articlesNiveau={data?.articlesNiveau || []} ventesArticles={data?.ventesArticles || []} boutiqueVentes={data?.boutiqueVentes || []} />}
                {activeTab === 'bulletins' && <ParentEnfantBulletins bulletinPublications={data?.bulletinPublications || []} />}
                {activeTab === 'profil' && <ParentEnfantProfilRadar notes={data?.notes || []} periodes={data?.periodes || []} bareme={enfant.classes?.niveaux?.cycles?.bareme || 20} eleve={enfant} schoolConfig={schoolConfig} famille={session?.famille} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}
