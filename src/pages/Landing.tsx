import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  GraduationCap, Users, BookOpen, Shield, Bus, Utensils,
  ArrowRight, Phone, Mail, MapPin, Download, Star, Clock, Award, Image
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import heroImage from '@/assets/hero-school.jpg';

export default function Landing() {
  const { data: schoolConfig } = useSchoolConfig();

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

  const stats = [
    { label: 'Élèves inscrits', value: '500+', icon: Users },
    { label: 'Années d\'excellence', value: '15+', icon: Award },
    { label: 'Taux de réussite', value: '98%', icon: Star },
    { label: 'Enseignants qualifiés', value: '40+', icon: BookOpen },
  ];

  const services = [
    {
      icon: BookOpen,
      title: 'Excellence Académique',
      description: 'Un programme rigoureux du Primaire au Collège, avec un suivi personnalisé de chaque élève.',
    },
    {
      icon: Shield,
      title: 'Environnement Sécurisé',
      description: 'Un campus surveillé et sécurisé pour le bien-être et la tranquillité de vos enfants.',
    },
    {
      icon: Utensils,
      title: 'Cantine Scolaire',
      description: 'Des repas équilibrés et variés préparés quotidiennement par notre équipe de cuisine.',
    },
    {
      icon: Bus,
      title: 'Transport Scolaire',
      description: 'Un service de ramassage couvrant les principaux quartiers de la ville.',
    },
    {
      icon: Clock,
      title: 'Activités Parascolaires',
      description: 'Karaté, sport, art et culture pour l\'épanouissement complet de chaque enfant.',
    },
    {
      icon: GraduationCap,
      title: 'Suivi Numérique',
      description: 'Accès en ligne aux notes, bulletins et informations scolaires via EduGestion Pro.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {schoolConfig?.logo_url ? (
                <img src={schoolConfig.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-contain" />
              ) : (
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground">
                  <GraduationCap className="h-5 w-5" />
                </div>
              )}
              <span className="font-bold text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {schoolConfig?.nom || 'EI Enfant du Futur'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isInstallable && (
                <Button variant="ghost" size="sm" onClick={install} className="hidden sm:flex">
                  <Download className="mr-2 h-4 w-4" />
                  Installer
                </Button>
              )}
              <Link to="/eleve">
                <Button variant="outline" size="sm">
                  Espace Élève
                </Button>
              </Link>
              <Link to="/parent">
                <Button variant="outline" size="sm">
                  Espace Parent
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm">
                  Espace Personnel
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Campus de l'école" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/80 via-foreground/60 to-foreground/30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-secondary/20 text-secondary rounded-full px-4 py-1.5 text-sm font-medium mb-6 backdrop-blur-sm">
              <Star className="h-4 w-4" />
              Inscriptions 2025-2026 ouvertes
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Investir maintenant<br />
              <span className="text-secondary">pour Sourire</span> demain !
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-lg">
              L'École Internationale Enfant du Futur offre un enseignement d'excellence 
              dans un environnement moderne et bienveillant, du Primaire au Collège.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/auth">
                <Button size="lg" className="text-base px-8">
                  <GraduationCap className="mr-2 h-5 w-5" />
                  Pré-inscrire mon enfant
                </Button>
              </Link>
              <a href="#services">
                <Button size="lg" variant="outline" className="text-base px-8 bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Découvrir l'école
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative -mt-16 z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-none shadow-lg">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Pourquoi choisir notre école ?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Un cadre exceptionnel et des méthodes pédagogiques modernes pour accompagner chaque enfant vers la réussite.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.title} className="group hover:shadow-lg transition-shadow border-border/60">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center mb-4">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  {service.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {service.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Investir maintenant pour Sourire demain !
          </h2>
          <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-8">
            Rejoignez la communauté EI Enfant du Futur et donnez à votre enfant les outils pour réussir.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="text-base px-8">
                Accéder à l'espace parent
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/download">
              <Button size="lg" variant="outline" className="text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <Download className="mr-2 h-5 w-5" />
                Installer l'Appli
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact / Footer */}
      <footer className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  EI Enfant du Futur
                </span>
              </div>
              <p className="text-background/60 text-sm leading-relaxed">
                L'École Internationale Enfant du Futur, un établissement d'excellence 
                dédié à l'épanouissement et à la réussite de chaque enfant.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Liens rapides
              </h3>
              <ul className="space-y-2 text-sm text-background/60">
                <li><Link to="/auth" className="hover:text-background transition-colors">Espace Personnel</Link></li>
                <li><Link to="/download" className="hover:text-background transition-colors">Télécharger l'Appli</Link></li>
                {schoolConfig?.logo_url && (
                  <li>
                    <button onClick={handleDownloadLogo} className="hover:text-background transition-colors flex items-center gap-2">
                      <Image className="h-3 w-3" /> Télécharger le Logo (PNG)
                    </button>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Contact
              </h3>
              <ul className="space-y-3 text-sm text-background/60">
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>+224 625 549 579 / 628 848 437</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span>eiefinfos@enfantsdufutur.com</span>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>C/Sanoyah - Sanoyah Rails, Guinée</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-background/10 mt-12 pt-8 text-center text-xs text-background/40">
            © {new Date().getFullYear()} EI Enfant du Futur — Tous droits réservés. Propulsé par Reve Jeune Prestation Sarlu (RJP SARLU).
          </div>
        </div>
      </footer>
    </div>
  );
}
