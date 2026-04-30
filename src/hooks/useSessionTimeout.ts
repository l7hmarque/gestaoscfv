import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MOTORISTA_TIMEOUT_MS = 18 * 60 * 60 * 1000; // 18 hours (rota inteira sem re-login)

export function useSessionTimeout() {
  const { signOut, user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timeoutMs, setTimeoutMs] = useState<number>(DEFAULT_TIMEOUT_MS);

  // Detecta se o usuário é motorista para estender a sessão
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      if (cancelled) return;
      const isMotorista = (data || []).some((r: any) => r.role === "motorista");
      setTimeoutMs(isMotorista ? MOTORISTA_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
    });
    return () => { cancelled = true; };
  }, [user]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      signOut();
    }, timeoutMs);
  }, [signOut, timeoutMs]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);
}
