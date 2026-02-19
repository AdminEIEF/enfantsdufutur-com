import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: string) => void;
  title?: string;
}

export default function QRScannerDialog({ open, onOpenChange, onScan, title = 'Scanner un QR Code' }: Props) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open) return;
    hasScannedRef.current = false;
    setError(null);

    let html5QrCode: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (!containerRef.current) return;

        html5QrCode = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText: string) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;
            playBeep();

            // Try to extract matricule from QR JSON
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
            // Ignore scan failures (no QR detected yet)
          }
        );
      } catch (err: any) {
        console.error('QR scanner error:', err);
        setError(err?.message || 'Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      }
    };

    // Small delay to let dialog render
    const timer = setTimeout(startScanner, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan, onOpenChange, playBeep]);

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
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
              {error}
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
