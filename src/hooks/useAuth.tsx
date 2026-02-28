import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'admin' | 'secretaire' | 'service_info' | 'comptable' | 'boutique' | 'cantine' | 'librairie';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_roles');
      if (!error && data) {
        setRoles(data as AppRole[]);
      }
    } catch {
      setRoles([]);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Skip if this is just a token refresh (not a real auth change)
        if (event === 'TOKEN_REFRESHED') {
          // Only update session/user, don't re-fetch roles
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => fetchRoles(), 0);
        } else {
          setRoles([]);
        }

        // Mark loading as done after first event
        if (!initializedRef.current) {
          initializedRef.current = true;
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      // Only set initial state if onAuthStateChange hasn't fired yet
      if (!initializedRef.current) {
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        if (existingSession?.user) {
          fetchRoles();
        }
        initializedRef.current = true;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (r: AppRole[]) => r.some(role => roles.includes(role));

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, hasRole, hasAnyRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
