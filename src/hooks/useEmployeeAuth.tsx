import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EmployeeData {
  id: string;
  nom: string;
  prenom: string;
  matricule: string;
  sexe: string | null;
  date_naissance: string | null;
  photo_url: string | null;
  categorie: string;
  poste: string;
  date_embauche: string;
  salaire_base: number;
  statut: string;
  telephone: string | null;
  email: string | null;
  enseignant_classes?: any[];
}

interface EmployeeSession {
  employe: EmployeeData;
  matricule: string;
  token: string;
}

interface EmployeeAuthContextType {
  session: EmployeeSession | null;
  loading: boolean;
  login: (matricule: string, password: string) => Promise<void>;
  logout: () => void;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | null>(null);

const STORAGE_KEY = 'employee_session';

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Listen for forced disconnect by admin
  useEffect(() => {
    if (!session?.employe?.id) return;
    const channel = supabase
      .channel(`employee-disconnect-${session.employe.id}`)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'active_connections',
        filter: `ref_id=eq.${session.employe.id}`,
      }, () => {
        setSession(null);
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/employee/login';
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.employe?.id]);

  const login = async (matricule: string, password: string) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ matricule: matricule.trim().toUpperCase(), password: password.trim() }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erreur de connexion');

    const newSession: EmployeeSession = {
      employe: data.employe,
      matricule: matricule.trim().toUpperCase(),
      token: data.token,
    };
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <EmployeeAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const ctx = useContext(EmployeeAuthContext);
  if (!ctx) throw new Error('useEmployeeAuth must be used within EmployeeAuthProvider');
  return ctx;
}
