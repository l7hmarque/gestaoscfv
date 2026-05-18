import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Telemetria invisível: a cada 30s envia 1 ping (somente quando a aba está visível).
 * Acumula em batch local e envia ao servidor a cada 4 pings (~2 min).
 * Lido apenas por coordenação via RLS.
 */
export function useActivityPing() {
  const { user } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const bufferRef = useRef<Array<{ user_id: string; session_id: string; route: string; created_at: string }>>([]);
  const routeRef = useRef(location.pathname);

  useEffect(() => {
    routeRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const flush = async () => {
      if (bufferRef.current.length === 0) return;
      const batch = bufferRef.current.splice(0, bufferRef.current.length);
      try {
        await (supabase.from as any)("user_activity_pings").insert(batch);
      } catch {
        // silencioso — telemetria não pode quebrar UX
      }
    };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      bufferRef.current.push({
        user_id: userId,
        session_id: sessionIdRef.current,
        route: routeRef.current,
        created_at: new Date().toISOString(),
      });
      if (bufferRef.current.length >= 4) flush();
    };

    const tickInterval = setInterval(tick, 30_000);
    const flushInterval = setInterval(flush, 120_000);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);

    return () => {
      clearInterval(tickInterval);
      clearInterval(flushInterval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [user?.id]);
}