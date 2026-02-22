import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Briefcase, KeyRound, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeLogin() {
  const { session, login, loading } = useEmployeeAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    navigate('/employe/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      await login(matricule, password);
      navigate('/employe/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Identifiants invalides");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500/10 via-background to-teal-500/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-2">
            <Briefcase className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Espace Personnel</h1>
          <p className="text-muted-foreground text-sm">École Internationale Enfant du Futur</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="h-5 w-5" /> Connexion Employé
            </CardTitle>
            <CardDescription>
              Connectez-vous avec votre matricule et le mot de passe fourni par l'administration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="matricule">Matricule</Label>
                <Input
                  id="matricule"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="Ex: EMP-001"
                  className="text-center text-lg tracking-widest font-mono"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  maxLength={30}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={submitting || !matricule.trim() || !password.trim()}>
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
