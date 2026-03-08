import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X, ShieldAlert, RefreshCw, Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: string) => void;
  title?: string;
  /** If true, scanner stays open after a scan for rapid continuous scanning */
  continuous?: boolean;
}

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'checking';

export default function QRScannerDialog({ open, onOpenChange, onScan, title = 'Scanner un QR Code', continuous = true }: Props) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef(0);
  const [scanCount, setScanCount] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

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
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio not available
    }
  }, []);

  const checkCameraPermission = useCallback(async (): Promise<PermissionStatus> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return 'unsupported';
    }
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return result.state as PermissionStatus;
      }
    } catch {
      // Permissions API not supported
    }
    return 'prompt';
  }, []);

  const requestCameraAccess = useCallback(async () => {
    setError(null);
    setPermissionStatus('checking');
    try {
      // Request with optimal settings for tablets
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      stream.getTracks().forEach(t => t.stop());
      setPermissionStatus('granted');
      return true;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setError("Accès à la caméra refusé. Veuillez autoriser l'accès dans les paramètres.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionStatus('unsupported');
        setError("Aucune caméra détectée sur cet appareil.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError("La caméra est utilisée par une autre application.");
      } else if (err.name === 'OverconstrainedError') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          fallbackStream.getTracks().forEach(t => t.stop());
          setPermissionStatus('granted');
          return true;
        } catch {
          setError("Impossible d'accéder à la caméra.");
        }
      } else {
        setError(err?.message || "Impossible d'accéder à la caméra.");
      }
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setScanCount(0);
    setLastScannedCode(null);
    lastScanRef.current = '';
    lastScanTimeRef.current = 0;

    let html5QrCode: any = null;
    let cancelled = false;

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionStatus('unsupported');
        setError("Navigateur incompatible. Utilisez Chrome ou Safari.");
        return;
      }

      const status = await checkCameraPermission();
      if (cancelled) return;

      if (status === 'denied') {
        setPermissionStatus('denied');
        setError("Accès caméra bloqué.");
        return;
      }

      const granted = await requestCameraAccess();
      if (cancelled || !granted) return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled || !containerRef.current) return;

        html5QrCode = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = html5QrCode;

        // Detect cameras - prefer back/environment camera
        let cameraConfig: any = { facingMode: 'environment' };
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
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
            fps: 30,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const minDim = Math.min(viewfinderWidth, viewfinderHeight);
              // Larger scan zone for tablets
              const size = Math.floor(minDim * 0.75);
              return { width: Math.max(size, 200), height: Math.max(size, 200) };
            },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decodedText: string) => {
            const now = Date.now();
            // Prevent duplicate scans of the same code within 2 seconds
            if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
              return;
            }

            lastScanRef.current = decodedText;
            lastScanTimeRef.current = now;

            playBeep();
            if (navigator.vibrate) navigator.vibrate(150);

            let matricule = decodedText;
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.matricule) matricule = parsed.matricule;
            } catch {
              // Not JSON
            }

            setScanCount(prev => prev + 1);
            setLastScannedCode(matricule);
            onScan(matricule);

            if (!continuous) {
              onOpenChange(false);
            }
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
            setError("Accès caméra refusé.");
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
  }, [open, onScan, onOpenChange, playBeep, checkCameraPermission, requestCameraAccess, continuous]);

  const handleRetry = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setError(null);
    setPermissionStatus('checking');
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Pointez la caméra vers le QR Code
            </p>
            {continuous && scanCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{scanCount} scanné{scanCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          <div
            id="qr-scanner-container"
            ref={containerRef}
            className="w-full rounded-lg overflow-hidden bg-black min-h-[280px]"
          />

          {/* Last scanned feedback in continuous mode */}
          {continuous && lastScannedCode && (
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-center">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                ✅ Dernier scan : <span className="font-bold">{lastScannedCode}</span>
              </p>
            </div>
          )}

          {permissionStatus === 'denied' && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm text-destructive space-y-1">
                  <p className="font-semibold">Caméra bloquée</p>
                  <p>Autorisez l'accès à la caméra :</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-xs">
                    <li><strong>iPad/iPhone :</strong> Réglages → Safari → Caméra → Autoriser</li>
                    <li><strong>Tablette Android :</strong> Paramètres → Applications → Chrome → Autorisations → Caméra</li>
                    <li><strong>PC :</strong> Icône 🔒 dans la barre d'adresse → Caméra → Autoriser</li>
                  </ul>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4" /> Réessayer
              </Button>
            </div>
          )}

          {permissionStatus === 'unsupported' && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning-foreground">
              <p className="font-semibold">Caméra non disponible</p>
              <p className="text-xs mt-1">Utilisez Chrome ou Safari sur une tablette ou téléphone.</p>
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
