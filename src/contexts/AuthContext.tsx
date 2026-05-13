import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Failsafe: nunca prender o app em loading se getSession travar (504/timeout do backend)
    const failsafe = setTimeout(() => setLoading(false), 8000);

    withTimeout(
      supabase.auth.getSession(),
      8000,
      "Tempo esgotado ao verificar a sessão. Tente novamente."
    )
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error("[Auth] getSession falhou:", err);
      })
      .finally(() => {
        clearTimeout(failsafe);
        setLoading(false);
      });

    return () => {
      clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000,
        "Tempo esgotado ao entrar. Se estiver no Preview, teste pelo domínio publicado."
      );
      return { error };
    } catch (err: any) {
      console.error("[Auth] signIn falhou:", err);
      const msg = String(err?.message || "");
      const friendly =
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? new Error("Falha de conexão com o servidor de autenticação. Tente novamente em instantes.")
          : (err instanceof Error ? err : new Error(msg || "Erro desconhecido ao entrar"));
      return { error: friendly };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });
      return { error };
    } catch (err: any) {
      console.error("[Auth] signUp falhou:", err);
      return { error: err instanceof Error ? err : new Error(String(err?.message || err)) };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth] signOut falhou:", err);
    } finally {
      // Garantir que estado local seja limpo mesmo se backend falhar
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
