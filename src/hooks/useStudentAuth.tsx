import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StudentEleve {
  id: string;
  nom: string;
  prenom: string;
  matricule: string;
  sexe: string | null;
  date_naissance: string | null;
  photo_url: string | null;
  statut: string;
  solde_cantine: number | null;
  option_cantine: boolean | null;
  option_fournitures: boolean | null;
  classe_id: string | null;
  classes: any;
}

interface StudentSession {
  eleve: StudentEleve;
  matricule: string;
  token: string;
}

interface StudentAuthContextType {
  session: StudentSession | null;
  loading: boolean;
  login: (matricule: string, password: string) => Promise<void>;
  logout: () => void;
}

const StudentAuthContext = createContext<StudentAuthContextType | null>(null);

const STORAGE_KEY = 'student_session';

export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StudentSession | null>(null);
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
    if (!session?.eleve?.id) return;
    const channel = supabase
      .channel(`student-disconnect-${session.eleve.id}`)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'active_connections',
        filter: `ref_id=eq.${session.eleve.id}`,
      }, () => {
        setSession(null);
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/student/login';
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.eleve?.id]);

  const login = async (matricule: string, password: string) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-auth`,
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

    const newSession: StudentSession = {
      eleve: data.eleve,
      matricule: matricule.trim().toUpperCase(),
      token: data.token || matricule.trim().toUpperCase(),
    };
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <StudentAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const ctx = useContext(StudentAuthContext);
  if (!ctx) throw new Error('useStudentAuth must be used within StudentAuthProvider');
  return ctx;
}
