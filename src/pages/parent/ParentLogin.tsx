import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useParentAuth } from '@/hooks/useParentAuth';
import { GraduationCap, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function ParentLogin() {
  const { session, login, loading } = useParentAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → redirect
  if (!loading && session) {
    navigate('/parent/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await login(code);
      navigate('/parent/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Code invalide");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Espace Parent</h1>
          <p className="text-muted-foreground text-sm">École Internationale Enfant du Futur</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" /> Connexion
            </CardTitle>
            <CardDescription>
              Entrez le code d'accès fourni par le secrétariat de l'école.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code d'accès</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: FAM-XXXX"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Accéder à mon espace
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour à l'accueil
          </Button>
        </div>
      </div>
    </div>
  );
}
