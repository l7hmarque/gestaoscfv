import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  History,
  Info,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Lote {
  id: string;
  lote_id: string;
  confirmado_por: string;
  confirmado_por_nome: string | null;
  confirmado_em: string;
  mes_referencia: string;
  total_despesas: number;
  total_ok: number;
  total_ajustes: number;
  total_bloqueadas: number;
  arquivos: Array<{ fileName: string; storageUrl?: string; qtdDespesas: number }>;
  resumo_warnings: Record<string, number>;
}

interface LoteDespesa {
  id: string;
  descricao: string;
  valor: number;
  fornecedor: string | null;
  data_lancamento: string;
  status_sit: string | null;
  sit_completo: boolean;
  pendente_comprovante: boolean;
}

export default function LotesImportadosTab() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLote, setOpenLote] = useState<Lote | null>(null);
  const [loteDespesas, setLoteDespesas] = useState<LoteDespesa[]>([]);
  const [loadingDesp, setLoadingDesp] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("despesa_lotes_importacao")
      .select("*")
      .order("confirmado_em", { ascending: false })
      .limit(100);
    if (error) {
      toast.error("Erro ao carregar histórico de lotes");
      setLoading(false);
      return;
    }
    setLotes((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (lote: Lote) => {
    setOpenLote(lote);
    setLoadingDesp(true);
    const { data, error } = await supabase
      .from("despesas")
      .select(
        "id, descricao, valor, fornecedor, data_lancamento, status_sit, sit_completo, pendente_comprovante"
      )
      .eq("lote_id", lote.lote_id)
      .order("data_lancamento");
    if (!error) setLoteDespesas((data as any) || []);
    setLoadingDesp(false);
  };

  const downloadDiagnostic = (lote: Lote) => {
    const blob = new Blob([JSON.stringify(lote, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SysCFV_DiagnosticoLote_${lote.mes_referencia}_${lote.lote_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" /> Lotes de importação
        </CardTitle>
        <Button size="sm" variant="ghost" className="gap-1 h-7" onClick={load}>
          <RefreshCcw className="h-3 w-3" /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : lotes.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Nenhum lote de importação registrado ainda.
          </p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px]">Data</TableHead>
                  <TableHead className="text-[11px]">Responsável</TableHead>
                  <TableHead className="text-[11px]">Mês ref.</TableHead>
                  <TableHead className="text-[11px]">Arquivos</TableHead>
                  <TableHead className="text-[11px]">Resumo</TableHead>
                  <TableHead className="text-[11px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((l) => (
                  <TableRow key={l.id} className="text-xs">
                    <TableCell>
                      {format(new Date(l.confirmado_em), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="truncate max-w-[160px]">
                      {l.confirmado_por_nome || l.confirmado_por.slice(0, 8)}
                    </TableCell>
                    <TableCell>{l.mes_referencia}</TableCell>
                    <TableCell>{(l.arquivos || []).length}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {l.total_despesas} total
                        </Badge>
                        {l.total_ok > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 border-emerald-400 text-emerald-700 gap-0.5"
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {l.total_ok}
                          </Badge>
                        )}
                        {l.total_ajustes > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1 border-amber-400 text-amber-700 gap-0.5"
                          >
                            <Info className="h-2.5 w-2.5" />
                            {l.total_ajustes}
                          </Badge>
                        )}
                        {l.total_bloqueadas > 0 && (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1 gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {l.total_bloqueadas}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => openDetail(l)}
                        >
                          <FileText className="h-3 w-3" /> Despesas
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => downloadDiagnostic(l)}
                        >
                          <Download className="h-3 w-3" /> Diagnóstico
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!openLote} onOpenChange={(v) => !v && setOpenLote(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Lote de {openLote && format(new Date(openLote.confirmado_em), "dd/MM/yy HH:mm")} —{" "}
              {openLote?.mes_referencia}
            </DialogTitle>
          </DialogHeader>
          {openLote && (
            <div className="space-y-3 text-xs">
              {/* Arquivos do lote */}
              <div>
                <div className="font-medium mb-1">Arquivos processados</div>
                <ul className="space-y-1">
                  {(openLote.arquivos || []).map((a, i) => (
                    <li key={i} className="flex items-center justify-between border rounded px-2 py-1">
                      <span className="truncate">{a.fileName}</span>
                      <div className="flex gap-1 items-center">
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          {a.qtdDespesas} desp.
                        </Badge>
                        {a.storageUrl && (
                          <a
                            href={a.storageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline text-[10px]"
                          >
                            abrir
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resumo de regras */}
              {openLote.resumo_warnings &&
                Object.keys(openLote.resumo_warnings).length > 0 && (
                  <div>
                    <div className="font-medium mb-1 flex items-center justify-between">
                      Regras aplicadas
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(openLote.resumo_warnings, null, 2)
                          );
                          toast.success("Copiado");
                        }}
                      >
                        <ClipboardCopy className="h-3 w-3" /> Copiar
                      </Button>
                    </div>
                    <ul className="space-y-0.5 text-[10px] font-mono">
                      {Object.entries(openLote.resumo_warnings)
                        .sort((a, b) => b[1] - a[1])
                        .map(([rule, count]) => (
                          <li key={rule} className="flex justify-between border-b py-0.5">
                            <span>{rule}</span>
                            <span className="text-muted-foreground">{count}×</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

              {/* Despesas do lote */}
              <div>
                <div className="font-medium mb-1">Despesas geradas</div>
                {loadingDesp ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
                  </div>
                ) : loteDespesas.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma despesa associada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Descrição</TableHead>
                        <TableHead className="text-[10px]">Fornecedor</TableHead>
                        <TableHead className="text-[10px]">Valor</TableHead>
                        <TableHead className="text-[10px]">Data</TableHead>
                        <TableHead className="text-[10px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loteDespesas.map((d) => (
                        <TableRow key={d.id} className="text-xs">
                          <TableCell className="max-w-[220px] truncate">{d.descricao}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{d.fornecedor}</TableCell>
                          <TableCell>R$ {Number(d.valor).toFixed(2)}</TableCell>
                          <TableCell>{d.data_lancamento}</TableCell>
                          <TableCell>
                            {d.sit_completo ? (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-400 text-emerald-700">
                                SIT OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1">
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}