import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { DataTable, Column } from "@/components/DataTable";
import { useMovimentacoes } from "@/hooks/useCozinhaData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { autoFitColumns } from "@/lib/xlsxAutoFit";

export default function MovimentacoesTab() {
  const { data: movs = [], isLoading } = useMovimentacoes();
  const [tipo, setTipo] = useState<string>("todos");

  const filtered = useMemo(() => tipo === "todos" ? movs : movs.filter((m: any) => m.tipo === tipo), [movs, tipo]);

  const consumo30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const map: Record<string, number> = {};
    movs.forEach((m: any) => {
      if (m.tipo !== "saida") return;
      if (new Date(m.created_at).getTime() < cutoff) return;
      const nome = m.insumo?.nome ?? "—";
      map[nome] = (map[nome] ?? 0) + Number(m.quantidade);
    });
    return Object.entries(map).map(([nome, total]) => ({ nome, total })).sort((a,b) => b.total - a.total).slice(0, 10);
  }, [movs]);

  function exportXLSX() {
    const rows = filtered.map((m: any) => ({
      Data: new Date(m.created_at).toLocaleString("pt-BR"),
      Insumo: m.insumo?.nome ?? "—",
      Tipo: m.tipo, Quantidade: `${m.quantidade} ${m.insumo?.unidade ?? ""}`,
      Motivo: m.motivo ?? "", Responsável: m.responsavel?.nome ?? "—",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    autoFitColumns(ws);
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const now = new Date();
    const stamp = `${now.toISOString().slice(0,10)}_${now.toTimeString().slice(0,5).replace(":","-")}`;
    saveAs(new Blob([buf]), `SysCFV_MovimentacoesCozinha_${stamp}.xlsx`);
  }

  const cols: Column<any>[] = [
    { key: "created_at", label: "Data", sortable: true, render: r => new Date(r.created_at).toLocaleString("pt-BR") },
    { key: "insumo", label: "Insumo", render: r => r.insumo?.nome ?? "—" },
    { key: "tipo", label: "Tipo", render: r => <Badge variant={r.tipo === "entrada" ? "default" : r.tipo === "saida" ? "destructive" : "outline"}>{r.tipo}</Badge> },
    { key: "quantidade", label: "Qtd", render: r => `${Number(r.quantidade).toLocaleString("pt-BR")} ${r.insumo?.unidade ?? ""}` },
    { key: "motivo", label: "Motivo", render: r => r.motivo ?? "—" },
    { key: "responsavel", label: "Responsável", render: r => r.responsavel?.nome ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Top 10 itens consumidos (últimos 30 dias)</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          {consumo30d.length === 0 ? <p className="text-sm text-muted-foreground">Sem saídas no período.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consumo30d}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted"/>
                <XAxis dataKey="nome" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Bar dataKey="total" fill="hsl(var(--primary))"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-40">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        <Button variant="outline" className="ml-auto" onClick={exportXLSX}><Download className="h-4 w-4 mr-2"/>Exportar XLSX</Button>
      </div>

      <Card><CardContent className="pt-6">
        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <DataTable data={filtered} columns={cols} searchPlaceholder="Buscar..." totalLabel="movimentações"/>
        )}
      </CardContent></Card>
    </div>
  );
}