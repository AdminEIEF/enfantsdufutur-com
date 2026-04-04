import { ReactNode, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Home, Calendar, FileText, LogOut, Briefcase, Clock, Mail, CalendarDays, BarChart3, Camera, User, Phone, AtSign, MapPin, Hash, Loader2 } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { SchoolWatermark } from '@/components/SchoolWatermark';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const NAV_ITEMS = [
  { path: '/employe/dashboard', icon: Home, label: 'Accueil' },
  { path: '/employe/planning', icon: CalendarDays, label: 'Planning' },
  { path: '/employe/conges', icon: Calendar, label: 'Congés' },
  { path: '/employe/paie', icon: FileText, label: 'Paie' },
  { path: '/employe/pointage', icon: Clock, label: 'Pointage' },
  { path: '/employe/courriers', icon: Mail, label: 'Courriers' },
  { path: '/employe/evaluation', icon: BarChart3, label: 'Évaluation' },
];

export function EmployeeLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useEmployeeAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!session) {
    navigate('/employe', { replace: true });
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/employe', { replace: true });
  };

  const emp = session.employe;
  const categorieLabel: Record<string, string> = {
    enseignant: 'Enseignant',
    administration: 'Administration',
    service: 'Service',
    direction: 'Direction',
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La photo ne doit pas dépasser 5 Mo');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `employes/${emp.id}/photo_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('photos').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      const photo_url = urlData.publicUrl;

      // Update via edge function
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token: session.token, action: 'update_photo', photo_url }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      // Update local session
      const updated = { ...session, employe: { ...emp, photo_url } };
      localStorage.setItem('employee_session', JSON.stringify(updated));
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const photoUrl = emp.photo_url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5 relative">
      <SchoolWatermark />
      
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-emerald-500/30 shadow-md">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-sm font-bold text-white">
                  {emp.prenom[0]}{emp.nom[0]}
                </div>
              )}
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-sm leading-tight text-foreground">{emp.prenom} {emp.nom}</h1>
              <p className="text-[11px] text-muted-foreground">{emp.poste}</p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <NotificationBell
              mode="employee"
              targetId={emp.id}
              token={session.token}
              onViewAll={() => navigate('/employe/notifications')}
            />
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5 pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border/50">
        <div className="max-w-4xl mx-auto flex">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-all ${
                  isActive
                    ? 'text-emerald-600 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className={`p-1 rounded-lg transition-all ${isActive ? 'bg-emerald-500/10' : ''}`}>
                  <item.icon className={`h-5 w-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                </div>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile dialog */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mon profil</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {/* Photo with upload */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-emerald-500/20 shadow-xl">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-3xl font-bold text-white">
                    {emp.prenom[0]}{emp.nom[0]}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">{emp.prenom} {emp.nom}</h3>
              <Badge className="bg-emerald-500/15 text-emerald-700 border-0 mt-1">
                {categorieLabel[emp.categorie] || emp.categorie}
              </Badge>
            </div>

            <div className="w-full space-y-3 bg-muted/30 rounded-xl p-4">
              <div className="flex items-center gap-3 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Matricule</span>
                <span className="ml-auto font-mono font-medium text-foreground">{emp.matricule}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Poste</span>
                <span className="ml-auto font-medium text-foreground">{emp.poste}</span>
              </div>
              {emp.telephone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Téléphone</span>
                  <a href={`tel:${emp.telephone}`} className="ml-auto font-medium text-emerald-600 hover:underline">{emp.telephone}</a>
                </div>
              )}
              {emp.email && (
                <div className="flex items-center gap-3 text-sm">
                  <AtSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email</span>
                  <span className="ml-auto font-medium text-foreground text-xs">{emp.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Embauche</span>
                <span className="ml-auto font-medium text-foreground">{emp.date_embauche}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Cliquez sur la photo pour la modifier
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
