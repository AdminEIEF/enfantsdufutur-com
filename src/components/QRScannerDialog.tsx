import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, ShieldAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: string) => void;
  title?: string;
}

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'checking';

export default function QRScannerDialog({ open, onOpenChange, onScan, title = 'Scanner un QR Code' }: Props) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const hasScannedRef = useRef(false);

  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not available
    }
  }, []);

  // Check camera support & permission status
  const checkCameraPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'unsupported';
    }
    try {
      // Use Permissions API if available (Chrome, Edge)
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return result.state as PermissionStatus;
      }
    } catch {
      // Permissions API not supported (Safari/Firefox) — fall through
    }
    return 'prompt';
  }, []);

  const requestCameraAccess = useCallback(async () => {
    setError(null);
    setPermissionStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      // Stop the test stream immediately
      stream.getTracks().forEach(t => t.stop());
      setPermissionStatus('granted');
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setError("Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur ou appareil.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionStatus('unsupported');
        setError("Aucune caméra détectée sur cet appareil.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError("La caméra est utilisée par une autre application. Fermez-la et réessayez.");
      } else if (err.name === 'OverconstrainedError') {
        // Try without facingMode constraint
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          fallbackStream.getTracks().forEach(t => t.stop());
          setPermissionStatus('granted');
          return true;
        } catch {
          setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
        }
      } else {
        setError(err?.message || "Impossible d'accéder à la caméra.");
      }
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    hasScannedRef.current = false;
    setError(null);

    let html5QrCode: any = null;
    let cancelled = false;

    const startScanner = async () => {
      // 1. Check support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionStatus('unsupported');
        setError("Votre navigateur ne supporte pas l'accès à la caméra. Utilisez Chrome, Safari ou Firefox.");
        return;
      }

      // 2. Check permission
      const status = await checkCameraPermission();
      if (cancelled) return;

      if (status === 'denied') {
        setPermissionStatus('denied');
        setError("Accès caméra bloqué. Allez dans Paramètres > Confidentialité > Caméra pour autoriser ce site.");
        return;
      }

      // 3. Request access
      const granted = await requestCameraAccess();
      if (cancelled || !granted) return;

      // 4. Start QR scanner
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled || !containerRef.current) return;

        html5QrCode = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = html5QrCode;

        // Detect available cameras to pick best one
        let cameraConfig: any = { facingMode: 'environment' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            // Prefer back camera
            const backCam = cameras.find(c =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('arrière') ||
              c.label.toLowerCase().includes('rear') ||
              c.label.toLowerCase().includes('environment')
            );
            if (backCam) {
              cameraConfig = { deviceId: { exact: backCam.id } };
            }
          }
        } catch {
          // fallback to facingMode
        }

        if (cancelled) return;

        await html5QrCode.start(
          cameraConfig,
          {
            fps: 25,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minDim = Math.min(viewfinderWidth, viewfinderHeight);
              const size = Math.floor(minDim * 0.7);
              return { width: Math.max(size, 150), height: Math.max(size, 150) };
            },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decodedText: string) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            playBeep();

            // Vibrate on mobile if available
            if (navigator.vibrate) {
              navigator.vibrate(200);
            }

            let matricule = decodedText;
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.matricule) matricule = parsed.matricule;
            } catch {
              // Not JSON, use raw text
            }

            onScan(matricule);
            onOpenChange(false);
          },
          () => {
            // Ignore scan failures
          }
        );
      } catch (err: any) {
        if (!cancelled) {
          console.error('QR scanner error:', err);
          if (err?.message?.includes('NotAllowedError') || err?.message?.includes('Permission')) {
            setPermissionStatus('denied');
            setError("Accès caméra refusé. Autorisez la caméra dans les paramètres de votre navigateur.");
          } else {
            setError(err?.message || "Impossible de démarrer le scanner.");
          }
        }
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan, onOpenChange, playBeep, checkCameraPermission, requestCameraAccess]);

  const handleRetry = async () => {
    // Close and reopen to retry
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setError(null);
    setPermissionStatus('checking');
    // Force re-mount by toggling
    onOpenChange(false);
    setTimeout(() => onOpenChange(true), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pointez la caméra vers le QR Code du badge scolaire
          </p>

          <div
            id="qr-scanner-container"
            ref={containerRef}
            className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]"
          />

          {permissionStatus === 'denied' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm text-destructive space-y-1">
                  <p className="font-semibold">Caméra bloquée</p>
                  <p>Pour scanner les QR codes, autorisez l'accès à la caméra :</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-xs">
                    <li><strong>iPhone/iPad :</strong> Réglages → Safari → Caméra → Autoriser</li>
                    <li><strong>Android :</strong> Paramètres → Applications → Chrome → Autorisations → Caméra</li>
                    <li><strong>Chrome PC :</strong> Cliquez sur l'icône 🔒 dans la barre d'adresse → Caméra → Autoriser</li>
                  </ul>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4" /> Réessayer après autorisation
              </Button>
            </div>
          )}

          {permissionStatus === 'unsupported' && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-foreground">
              <p className="font-semibold">Caméra non disponible</p>
              <p className="text-xs mt-1">Votre navigateur ou appareil ne supporte pas l'accès à la caméra. Utilisez Chrome ou Safari sur un téléphone/tablette.</p>
            </div>
          )}

          {error && permissionStatus !== 'denied' && permissionStatus !== 'unsupported' && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive space-y-2">
              {error}
              <Button variant="outline" size="sm" className="w-full gap-2 mt-2" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4" /> Réessayer
              </Button>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" /> Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
