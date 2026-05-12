import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Lanc {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  nr_documento: string | null;
  despesa_id: string | null;
}

interface Props { mesRef: string; refreshKey?: number }

export default function ConciliacaoExtratoCard({ mesRef, refreshKey }: Props) {
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("controle_bancario_lancamentos")
        .select("id, data, descricao, valor, nr_documento, despesa_id")
        .eq("mes_referencia", mesRef)
        .order("data", { ascending: true });
      if (error) throw error;
      setLancs((data as any[]) || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [mesRef, refreshKey]);

  const reconciliar = async () => {
    setReconciling(true);
    try {
      const { data, error } = await (supabase as any).rpc("match_controle_bancario_to_despesas", { p_mes: mesRef });
      if (error) throw error;
      const m = Array.isArray(data) ? data[0] : data;
      toast.success(`Conciliados ${m?.matched ?? 0}/${m?.total ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setReconciling(false);
    }
  };

  if (lancs.length === 0) return null;

  const semDespesa = lancs.filter((l) => !l.despesa_id);
  const conciliados = lancs.length - semDespesa.length;
  const pct = Math.round((conciliados / lancs.length) * 100);
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtData = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Conciliação com extrato — {mesRef}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-1">
          <Badge variant="outline" className="text-[10px]">Lançamentos: {lancs.length}</Badge>
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Conciliados: {conciliados} ({pct}%)
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
            <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Sem despesa: {semDespesa.length}
          </Badge>
          <Button size="sm" variant="outline" className="h-6 text-[10px] ml-auto" onClick={reconciliar} disabled={reconciling || loading}>
            {reconciling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Reconciliar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {semDespesa.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Todos os lançamentos do extrato têm uma despesa correspondente. Nada faltando.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Os lançamentos abaixo aparecem no extrato mas <b>não foram pareados</b> com nenhuma despesa lançada.
              Verifique se faltam NF/comprovante para enviar pela Caixa de Entrada.
            </p>
            <div className="rounded border divide-y max-h-64 overflow-auto">
              {semDespesa.map((l) => (
                <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 text-[11px]">
                  <span className="text-muted-foreground w-10 shrink-0">{fmtData(l.data)}</span>
                  <span className="flex-1 truncate" title={l.descricao}>{l.descricao}</span>
                  {l.nr_documento && <span className="text-[10px] text-muted-foreground shrink-0">#{l.nr_documento}</span>}
                  <span className="font-mono font-medium shrink-0">R$ {fmtBRL(Number(l.valor))}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}