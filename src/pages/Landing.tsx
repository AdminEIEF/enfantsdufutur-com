// Landing page
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap, Users, BookOpen, Shield, Bus, Utensils,
  ArrowRight, Phone, Mail, MapPin, Download, Star, Clock, Award, Image, Briefcase,
  ChevronRight, Sparkles
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { motion } from 'framer-motion';
import LandingTarifs from '@/components/LandingTarifs';
import SplashScreen from '@/components/SplashScreen';
import heroImage from '@/assets/hero-school.jpg';
import schoolLogo from '@/assets/school-logo.png';
import schoolAnglais from '@/assets/school-anglais.jpg';
import schoolBepc from '@/assets/school-bepc.jpg';
import schoolDrapeau from '@/assets/school-drapeau.jpg';
import schoolGraduation from '@/assets/school-graduation.jpg';
import schoolCantine from '@/assets/school-cantine.jpg';
import schoolJeux from '@/assets/school-jeux.jpg';
import schoolMaternelle from '@/assets/school-maternelle.jpg';
import schoolClasse from '@/assets/school-classe.jpg';
import schoolEvent1 from '@/assets/school-event1.jpg';
import schoolEvent2 from '@/assets/school-event2.jpg';
import schoolEvent3 from '@/assets/school-event3.jpg';
import schoolEvent4 from '@/assets/school-event4.jpg';
import schoolEvent5 from '@/assets/school-event5.jpg';
import schoolEvent6 from '@/assets/school-event6.jpg';

// Logo-inspired color palette
const COLORS = {
  green: '#1B8B3D',
  greenLight: '#22A94A',
  greenBg: 'rgba(27,139,61,0.08)',
  red: '#C41E3A',
  redLight: '#E02B4A',
  redBg: 'rgba(196,30,58,0.08)',
  gold: '#F5A623',
  goldLight: '#FFB840',
  goldBg: 'rgba(245,166,35,0.08)',
  dark: '#1a1a2e',
};

export default function Landing() {
  const { data: schoolConfig } = useSchoolConfig();
  const [showSplash, setShowSplash] = useState(() => {
    const seen = sessionStorage.getItem('splash-landing-seen');
    return !seen;
  });
  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('splash-landing-seen', '1');
    setShowSplash(false);
  }, []);

  const handleDownloadLogo = async () => {
    if (!schoolConfig?.logo_url) return;
    try {
      const response = await fetch(schoolConfig.logo_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logo-ei-enfant-du-futur.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(schoolConfig.logo_url, '_blank');
    }
  };
  const { isInstallable, install } = usePWAInstall();

  const { data: dbStats } = useQuery({
    queryKey: ['landing-stats'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_landing_stats');
      return data as { eleves: number; enseignants: number } | null;
    },
  });

  const anneesExcellence = new Date().getFullYear() - 2020;

  const stats = [
    { label: 'Élèves inscrits', value: `${dbStats?.eleves ?? 0}`, icon: Users, color: COLORS.green, bg: COLORS.greenBg },
    { label: "Années d'excellence", value: `+${anneesExcellence}`, icon: Award, color: COLORS.gold, bg: COLORS.goldBg },
    { label: 'Taux de réussite', value: '100%', icon: Star, color: COLORS.red, bg: COLORS.redBg },
    { label: 'Enseignants qualifiés', value: `${dbStats?.enseignants ?? 0}`, icon: BookOpen, color: COLORS.green, bg: COLORS.greenBg },
  ];

  const services = [
    { icon: BookOpen, title: 'Excellence Académique', description: 'Un programme rigoureux de la Crèche au Lycée, avec un suivi personnalisé de chaque élève.', color: COLORS.green, bg: COLORS.greenBg },
    { icon: Shield, title: 'Environnement Sécurisé', description: 'Un campus surveillé et sécurisé pour le bien-être et la tranquillité de vos enfants.', color: COLORS.red, bg: COLORS.redBg },
    { icon: Utensils, title: 'Cantine Scolaire', description: 'Des repas équilibrés et variés préparés quotidiennement par notre équipe de cuisine.', color: COLORS.gold, bg: COLORS.goldBg },
    { icon: Bus, title: 'Transport Scolaire', description: "Un service de ramassage couvrant les principaux quartiers de la ville.", color: COLORS.green, bg: COLORS.greenBg },
    { icon: Clock, title: 'Activités Parascolaires', description: "Karaté, sport, art et culture pour l'épanouissement complet de chaque enfant.", color: COLORS.red, bg: COLORS.redBg },
    { icon: GraduationCap, title: 'Suivi Numérique', description: "Accès en ligne aux notes, bulletins et informations scolaires via EduGestion Pro.", color: COLORS.gold, bg: COLORS.goldBg },
  ];

  const portalButtons = [
    { to: '/eleve', icon: GraduationCap, label: 'Espace Élève', sub: 'Notes & Cours', gradient: 'linear-gradient(135deg, #7C3AED, #9333EA)', shadow: 'rgba(124,58,237,0.4)' },
    { to: '/parent', icon: Users, label: 'Espace Parent', sub: 'Suivi scolaire', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', shadow: 'rgba(245,158,11,0.4)' },
    { to: '/employe', icon: Briefcase, label: 'Employé', sub: 'Espace RH', gradient: 'linear-gradient(135deg, #059669, #047857)', shadow: 'rgba(5,150,105,0.4)' },
    { to: '/auth', icon: Shield, label: 'Admin', sub: 'Gestion', gradient: 'linear-gradient(135deg, #2563EB, #1D4ED8)', shadow: 'rgba(37,99,235,0.4)' },
  ];

  const carouselImages = [
    { src: schoolAnglais, alt: "Anglais et Informatique dès la maternelle" },
    { src: schoolCantine, alt: "La cantine scolaire" },
    { src: schoolMaternelle, alt: "Activités en maternelle" },
    { src: schoolClasse, alt: "Salle de classe décorée" },
    { src: schoolJeux, alt: "Espace jeux et détente" },
    { src: schoolBepc, alt: "100% d'admission au BEPC" },
    { src: schoolDrapeau, alt: "Cérémonie du drapeau" },
    { src: schoolGraduation, alt: "Cérémonie de graduation" },
    { src: schoolEvent1, alt: "Présentation et conférence" },
    { src: schoolEvent2, alt: "Notre équipe pédagogique" },
    { src: schoolEvent3, alt: "Intervention du directeur" },
    { src: schoolEvent4, alt: "Réunion avec les parents" },
    { src: schoolEvent5, alt: "Membre de l'équipe" },
    { src: schoolEvent6, alt: "Accueil des familles" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-border/50" style={{ background: 'rgba(255,255,255,0.92)' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" onClick={() => window.scrollTo(0, 0)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={schoolConfig?.logo_url || schoolLogo} alt="Logo EIEF" className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl object-contain bg-white shadow-sm border border-border/30 p-0.5" />
              <span className="hidden md:block font-bold text-sm" style={{ color: COLORS.green, fontFamily: 'Space Grotesk, sans-serif' }}>
                E.I.E.F
              </span>
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isInstallable && (
                <Button variant="ghost" size="sm" onClick={install} className="hidden lg:flex text-xs">
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Installer
                </Button>
              )}
              {portalButtons.map(p => (
                <Link key={p.to} to={p.to}>
                  <button
                    className="flex items-center gap-1 text-white text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all hover:scale-105 hover:shadow-lg active:scale-95"
                    style={{ background: p.gradient, boxShadow: `0 2px 8px ${p.shadow}` }}
                  >
                    <p.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">{p.label}</span>
                  </button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-14 sm:pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Campus" className="w-full h-full object-cover" decoding="async" fetchPriority="high" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(27,139,61,0.85) 0%, rgba(26,26,46,0.80) 50%, rgba(196,30,58,0.70) 100%)' }} />
        </div>

        {/* Floating logo watermark */}
        <div className="absolute top-20 right-8 sm:right-16 w-32 h-32 sm:w-48 sm:h-48 opacity-10 pointer-events-none z-[1]">
          <img src={schoolLogo} alt="" className="w-full h-full object-contain" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 lg:py-28 z-[2]">
          <div className="max-w-3xl">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold mb-6 backdrop-blur-md"
              style={{ background: 'rgba(245,166,35,0.2)', color: COLORS.goldLight, border: `1px solid ${COLORS.gold}40` }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Inscriptions 2025-2026 ouvertes
            </motion.div>

            {/* School Name */}
            <motion.div
              initial={{ opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mb-2"
            >
              <p className="text-lg sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-[0.15em]" style={{ color: COLORS.redLight, fontFamily: 'Space Grotesk, sans-serif' }}>
                Ecole Internationale
              </p>
              <h1 className="text-2xl sm:text-4xl lg:text-[3.2rem] font-extrabold leading-none" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                <span style={{ color: COLORS.goldLight }}>LES ENFANTS </span>
                <span style={{ color: '#4ADE80' }}>DU FUTUR</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-xl sm:text-3xl font-bold text-white/90 italic mb-6"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Faisons plus !
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="text-xl sm:text-3xl lg:text-5xl font-bold text-white leading-tight mb-5"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Investir maintenant<br />
              <span style={{ color: COLORS.goldLight }}>pour Sourire</span> demain !
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="text-sm sm:text-lg text-white/75 mb-8 max-w-lg leading-relaxed"
            >
              L'École Internationale Enfant du Futur offre un enseignement d'excellence
              dans un environnement moderne et bienveillant, de la Crèche au Lycée.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/pre-inscription">
                <button
                  className="flex items-center gap-2 text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenLight})`, boxShadow: `0 8px 25px rgba(27,139,61,0.4)` }}
                >
                  <GraduationCap className="h-5 w-5" />
                  Pré-inscrire mon enfant
                </button>
              </Link>
              <a href="#services">
                <button className="flex items-center gap-2 text-white font-semibold text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl backdrop-blur-md transition-all hover:scale-105 active:scale-95" style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)' }}>
                  Découvrir l'école
                  <ChevronRight className="h-4 w-4" />
                </button>
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Stats (Material Cards) ─── */}
      <section className="relative -mt-10 sm:-mt-14 z-10 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * i }}
            >
              <Card className="border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 overflow-hidden" style={{ borderBottom: `3px solid ${stat.color}` }}>
                <CardContent className="flex items-center gap-3 p-3.5 sm:p-5">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center" style={{ background: stat.bg }}>
                    <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: stat.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold" style={{ color: stat.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                      {stat.value}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Image Carousel ─── */}
      <section className="py-10 sm:py-16">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-3" style={{ background: COLORS.greenBg, color: COLORS.green }}>
              <Image className="h-3.5 w-3.5" /> Galerie
            </motion.div>
            <h2 className="text-xl sm:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Notre école en images
            </h2>
          </div>
          <Carousel
            opts={{ loop: true, align: 'start' }}
            plugins={[Autoplay({ delay: 4000, stopOnInteraction: false })]}
            className="w-full"
          >
            <CarouselContent>
              {carouselImages.map((img, i) => (
                <CarouselItem key={i} className="basis-full sm:basis-1/2 lg:basis-1/3">
                  <div className="p-1.5">
                    <div className="overflow-hidden rounded-3xl shadow-lg group">
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-full h-48 sm:h-56 lg:h-64 object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </section>

      {/* ─── Services (Android Material Cards) ─── */}
      <section id="services" className="py-16 sm:py-24" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(27,139,61,0.03) 50%, transparent 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-3" style={{ background: COLORS.redBg, color: COLORS.red }}>
              <Star className="h-3.5 w-3.5" /> Nos services
            </motion.div>
            <h2 className="text-2xl sm:text-4xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Pourquoi choisir notre école ?
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
              Un cadre exceptionnel et des méthodes pédagogiques modernes pour accompagner chaque enfant vers la réussite.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.08 * i }}
              >
                <Card className="group border-border/40 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-3xl overflow-hidden">
                  <CardContent className="p-6 sm:p-7">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg" style={{ background: service.bg, boxShadow: `0 4px 15px ${service.color}15` }}>
                      <service.icon className="h-7 w-7" style={{ color: service.color }} />
                    </div>
                    <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Vidéos ─── */}
      <section className="py-12 sm:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-3" style={{ background: COLORS.goldBg, color: COLORS.gold }}>
              <Sparkles className="h-3.5 w-3.5" /> Vidéos
            </motion.div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Notre école en vidéo
            </h2>
            <p className="text-muted-foreground text-sm sm:text-lg max-w-2xl mx-auto">
              Découvrez l'ambiance et les activités de l'École Internationale Les Enfants du Futur.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {[
              { id: '3512882682204390', title: "Vidéo de l'école 1" },
              { id: '1617863476248678', title: "Vidéo de l'école 2" },
              { id: '3843230585974453', title: "Vidéo de l'école 3" },
            ].map((video) => (
              <div key={video.id} className="rounded-3xl overflow-hidden shadow-xl border border-border/30">
                <iframe
                  src={`https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F${video.id}&show_text=false&width=300&height=265`}
                  className="w-full"
                  style={{ border: 'none', overflow: 'hidden', height: '265px', objectFit: 'cover' }}
                  scrolling="no"
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  title={video.title}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tarifs ─── */}
      <LandingTarifs />

      {/* ─── Portal CTA (Android App Grid) ─── */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.dark} 0%, #16213e 50%, ${COLORS.dark} 100%)` }}>
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-10" style={{ background: COLORS.green, filter: 'blur(80px)' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: COLORS.red, filter: 'blur(100px)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full opacity-5" style={{ background: COLORS.gold, filter: 'blur(60px)' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Accédez à votre espace
            </h2>
            <p className="text-white/60 text-sm sm:text-lg max-w-xl mx-auto mb-10">
              Connectez-vous à votre portail pour accéder à vos informations scolaires.
            </p>
          </motion.div>

          {/* App-style grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-2xl mx-auto mb-10">
            {portalButtons.map((p, i) => (
              <motion.div
                key={p.to}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
              >
                <Link to={p.to} className="group block">
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl group-active:scale-95"
                      style={{ background: p.gradient, boxShadow: `0 8px 30px ${p.shadow}` }}
                    >
                      <p.icon className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm sm:text-base">{p.label}</p>
                      <p className="text-white/50 text-[10px] sm:text-xs">{p.sub}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Install & Pre-inscription */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/pre-inscription">
              <button
                className="flex items-center gap-2 text-white font-bold text-sm px-6 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95"
                style={{ background: `linear-gradient(135deg, ${COLORS.gold}, ${COLORS.goldLight})`, boxShadow: `0 6px 20px rgba(245,166,35,0.35)` }}
              >
                <GraduationCap className="h-4 w-4" />
                Pré-inscrire mon enfant
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/download">
              <button
                className="flex items-center gap-2 text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)' }}
              >
                <Download className="h-4 w-4" />
                Installer l'Appli
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ background: COLORS.dark }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <img src={schoolLogo} alt="Logo" className="w-12 h-12 rounded-2xl bg-white p-1 shadow-lg" />
                <div>
                  <span className="font-bold text-sm text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    École Internationale
                  </span>
                  <p className="text-xs font-semibold" style={{ color: COLORS.greenLight }}>Les Enfants du Futur</p>
                </div>
              </div>
              <p className="text-white/50 text-sm leading-relaxed">
                Un établissement d'excellence dédié à l'épanouissement et à la réussite de chaque enfant.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4 text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Liens rapides
              </h3>
              <ul className="space-y-2.5 text-sm text-white/50">
                <li><Link to="/auth" className="hover:text-white transition-colors flex items-center gap-2"><ChevronRight className="h-3 w-3" style={{ color: COLORS.green }} /> Espace Admin</Link></li>
                <li><Link to="/employe" className="hover:text-white transition-colors flex items-center gap-2"><ChevronRight className="h-3 w-3" style={{ color: COLORS.green }} /> Portail Employé</Link></li>
                <li><Link to="/download" className="hover:text-white transition-colors flex items-center gap-2"><ChevronRight className="h-3 w-3" style={{ color: COLORS.green }} /> Télécharger l'Appli</Link></li>
                {schoolConfig?.logo_url && (
                  <li>
                    <button onClick={handleDownloadLogo} className="hover:text-white transition-colors flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" style={{ color: COLORS.green }} /> Télécharger le Logo
                    </button>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-white mb-4 text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Contact
              </h3>
              <ul className="space-y-3 text-sm text-white/50">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.greenBg }}>
                    <Phone className="h-3.5 w-3.5" style={{ color: COLORS.greenLight }} />
                  </div>
                  <span>+224 625 549 579 / 628 848 437</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.redBg }}>
                    <Mail className="h-3.5 w-3.5" style={{ color: COLORS.redLight }} />
                  </div>
                  <span>eiefinfos@enfantsdufutur.com</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: COLORS.goldBg }}>
                    <MapPin className="h-3.5 w-3.5" style={{ color: COLORS.goldLight }} />
                  </div>
                  <span>C/Sanoyah - Sanoyah Rails, Guinée</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 text-center text-xs text-white/30" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            © {new Date().getFullYear()} Edugestion Pro v1.0 — Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
