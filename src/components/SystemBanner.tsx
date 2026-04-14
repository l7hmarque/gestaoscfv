import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertTriangle, Info, AlertCircle } from "lucide-react";

interface Aviso {
  id: string;
  mensagem: string;
  tipo: string;
}

const TIPO_CONFIG: Record<string, { bg: string; icon: typeof Info }> = {
  info: { bg: "bg-blue-600", icon: Info },
  warning: { bg: "bg-amber-600", icon: AlertTriangle },
  urgent: { bg: "bg-red-700", icon: AlertCircle },
};

export function SystemBanner() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("avisos_sistema" as any)
      .select("id, mensagem, tipo")
      .eq("ativo", true)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .then(({ data }) => {
        if (data) setAvisos(data as any);
      });
  }, []);

  const visible = avisos.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="print:hidden">
      {visible.map((aviso) => {
        const config = TIPO_CONFIG[aviso.tipo] || TIPO_CONFIG.info;
        const Icon = config.icon;
        return (
          <div
            key={aviso.id}
            className={`${config.bg} text-white px-4 py-2 flex items-center justify-center gap-2 text-sm`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-center flex-1">{aviso.mensagem}</span>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(aviso.id))}
              className="shrink-0 hover:opacity-70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
