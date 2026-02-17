import { GraduationCap, Download, Smartphone, Monitor, Apple, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export default function DownloadPage() {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-16 px-4 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-foreground/20 mb-4">
          <GraduationCap className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold mb-2">EduGestion Pro</h1>
        <p className="text-primary-foreground/80 text-lg max-w-md mx-auto">
          Installez l'application sur votre appareil pour un accès rapide et hors-ligne.
        </p>
        {isInstalled ? (
          <div className="mt-6 inline-flex items-center gap-2 bg-primary-foreground/20 rounded-full px-6 py-3 text-sm font-medium">
            ✅ Application déjà installée
          </div>
        ) : isInstallable ? (
          <Button
            onClick={install}
            size="lg"
            variant="secondary"
            className="mt-6 text-lg px-8"
          >
            <Download className="mr-2 h-5 w-5" />
            Installer maintenant
          </Button>
        ) : (
          <p className="mt-6 text-primary-foreground/70 text-sm">
            Suivez les instructions ci-dessous pour installer l'application.
          </p>
        )}
      </div>

      {/* Instructions */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <h2 className="text-2xl font-bold text-center mb-8">Comment installer l'application ?</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Android */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent">
                  <Smartphone className="h-5 w-5" />
                </div>
                Android (Chrome)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <span>Ouvrez cette page dans <strong>Google Chrome</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <span>Appuyez sur le menu <strong>⋮</strong> (trois points) en haut à droite</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <span>Sélectionnez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <span>Confirmez en appuyant sur <strong>« Installer »</strong></span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* iOS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent">
                  <Apple className="h-5 w-5" />
                </div>
                iPhone / iPad (Safari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <span>Ouvrez cette page dans <strong>Safari</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <span>Appuyez sur le bouton <strong>Partager</strong> (carré avec flèche vers le haut)</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <span>Faites défiler et sélectionnez <strong>« Sur l'écran d'accueil »</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                  <span>Appuyez sur <strong>« Ajouter »</strong> en haut à droite</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Desktop Chrome */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 text-accent">
                  <Chrome className="h-5 w-5" />
                </div>
                Ordinateur (Chrome)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                  <span>Ouvrez cette page dans <strong>Google Chrome</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                  <span>Cliquez sur l'icône <strong>⊕</strong> dans la barre d'adresse</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                  <span>Cliquez sur <strong>« Installer »</strong></span>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Avantages */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                  <Monitor className="h-5 w-5" />
                </div>
                Avantages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">✅ Accès rapide depuis l'écran d'accueil</li>
                <li className="flex gap-2">✅ Fonctionne sans barre d'adresse du navigateur</li>
                <li className="flex gap-2">✅ Consultation des stocks hors-ligne (Cantine, Boutique)</li>
                <li className="flex gap-2">✅ Pas besoin de télécharger depuis un App Store</li>
                <li className="flex gap-2">✅ Mises à jour automatiques</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center pt-8">
          <a href="/auth" className="text-primary hover:underline font-medium">
            ← Retour à la connexion
          </a>
        </div>
      </div>
    </div>
  );
}
