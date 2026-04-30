import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  enfileirarEmbarque,
  listarPendentes,
  atualizarPendente,
  removerPendente,
  type PendenteEmbarque,
} from "@/lib/offlineDB";
import { toast } from "sonner";

/**
 * Hook que gerencia o estado offline da página de transporte:
 * - detecta online/offline
 * - mantém lista de check-ins pendentes (não enviados)
 * - sincroniza automaticamente quando volta a internet
 */
export function useTransporteOffline(onSincronizado?: () => void) {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendentes, setPendentes] = useState<PendenteEmbarque[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const sincRef = useRef(false);

  const recarregarPendentes = useCallback(async () => {
    try {
      const lista = await listarPendentes();
      setPendentes(lista);
    } catch (e) {
      console.error("[offline] erro ao listar pendentes", e);
    }
  }, []);

  const sincronizar = useCallback(async () => {
    if (sincRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    sincRef.current = true;
    setSincronizando(true);
    let enviados = 0;
    let falhas = 0;
    try {
      const lista = await listarPendentes();
      for (const item of lista) {
        if (item.tentativas >= 5) continue;
        try {
          await atualizarPendente({ ...item, status: "enviando" });
          // upsert por (participante_id, data, periodo)
          const { error } = await supabase
            .from("participante_checkins")
            .upsert(
              {
                participante_id: item.participante_id,
                data: item.data,
                periodo: item.periodo,
                embarcou: item.embarcou,
                embarcou_em: item.embarcou_em,
              } as any,
              { onConflict: "participante_id,data,periodo" }
            );
          if (error) throw error;
          await removerPendente(item.id_local);
          enviados++;
        } catch (e: any) {
          falhas++;
          await atualizarPendente({
            ...item,
            status: "erro",
            tentativas: item.tentativas + 1,
            ultimo_erro: e?.message || String(e),
          });
        }
      }
    } finally {
      sincRef.current = false;
      setSincronizando(false);
      await recarregarPendentes();
      if (enviados > 0) {
        toast.success(`${enviados} embarque${enviados > 1 ? "s" : ""} sincronizado${enviados > 1 ? "s" : ""}`);
        onSincronizado?.();
      }
      if (falhas > 0) {
        toast.error(`${falhas} embarque${falhas > 1 ? "s" : ""} não pôde ser enviado`);
      }
    }
  }, [onSincronizado, recarregarPendentes]);

  // Listeners online/offline + carga inicial + intervalo
  useEffect(() => {
    recarregarPendentes();
    const handleOnline = () => {
      setOnline(true);
      sincronizar();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // tenta sincronizar imediatamente caso esteja online com pendentes antigos
    if (navigator.onLine) sincronizar();
    const id = setInterval(() => {
      if (navigator.onLine) sincronizar();
    }, 30000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Marca embarque: tenta direto se online, fila se offline. Retorna true se gravou no servidor. */
  const marcarEmbarqueOffline = useCallback(
    async (input: {
      participante_id: string;
      data: string;
      periodo: "manha" | "tarde";
      embarcou: boolean;
    }): Promise<{ enviado: boolean; pendente?: PendenteEmbarque }> => {
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (isOnline) {
        try {
          const { error } = await supabase
            .from("participante_checkins")
            .upsert(
              {
                participante_id: input.participante_id,
                data: input.data,
                periodo: input.periodo,
                embarcou: input.embarcou,
                embarcou_em: new Date().toISOString(),
              } as any,
              { onConflict: "participante_id,data,periodo" }
            );
          if (error) throw error;
          return { enviado: true };
        } catch (e) {
          // Sem conectividade real ou falhou: cai para fila
          const p = await enfileirarEmbarque(input);
          await recarregarPendentes();
          return { enviado: false, pendente: p };
        }
      }
      const p = await enfileirarEmbarque(input);
      await recarregarPendentes();
      return { enviado: false, pendente: p };
    },
    [recarregarPendentes]
  );

  // mapa rápido por (participante_id|periodo) para a UI exibir badge "aguardando"
  const pendentesMap = pendentes.reduce<Record<string, PendenteEmbarque>>((acc, p) => {
    acc[`${p.participante_id}_${p.periodo}`] = p;
    return acc;
  }, {});

  return {
    online,
    pendentes,
    pendentesMap,
    sincronizando,
    sincronizar,
    marcarEmbarqueOffline,
    recarregarPendentes,
  };
}