import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Download, Pill, Info } from "lucide-react";
import { DataTable, Column } from "@/components/DataTable";
import { useRestricoesAlimentares, getCategoriaRestricao, DIAS_SEMANA, ParticipanteRestricao } from "@/hooks/useCozinhaData";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import { autoFitColumns } from "@/lib/xlsxAutoFit";

const COR_BORDER: Record<string, string> = {
  red: "border-l-destructive",
  amber: "border-l-amber-500",
  green: "border-l-emerald-500",
  blue: "border-l-blue-500",
  muted: "border-l-muted-foreground",
};
const COR_BADGE: Record<string, string> = {
  red: "bg-destructive text-destructive-foreground",
  amber: "bg-amber-500 text-white",
  green: "bg-emerald-500 text-white",
  blue: "bg-blue-500 text-white",
  muted: "bg-muted text-foreground",
};

export default function RestricoesTab() {
  const { data: parts = [], isLoading } = useRestricoesAlimentares();
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<string>("todos");

  const filtered = useMemo(() => {
    return parts.filter(p => {
      if (periodo !== "todos" && p.periodo !== periodo) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hay = `${p.nome} ${p.restricao_alimentar ?? ""} ${p.bairro ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [parts, busca, periodo]);

  const graves = useMemo(() => filtered.filter(p => getCategoriaRestricao(p.restricao_alimentar).grave), [filtered]);

  function exportXLSX() {
    const rows = filtered.map(p => ({
      Nome: p.nome, Idade: p.idade ?? "—", Período: p.periodo ?? "—", Bairro: p.bairro ?? "—",
      Restrição: p.restricao_alimentar ?? "", "Remédio contínuo": p.remedio_continuo ?? "",
      "Outras condições": p.outras_condicoes ?? "",
      Turmas: p.turmas.map(t => t.nome).join(", "),
      "Dias frequenta": p.dias_frequenta.join(", "),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    autoFitColumns(ws, rows);
    XLSX.utils.book_append_sheet(wb, ws, "Restrições");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const now = new Date();
    const stamp = `${now.toISOString().slice(0,10)}_${now.toTimeString().slice(0,5).replace(":","-")}`;
    saveAs(new Blob([buf]), `SysCFV_RestricoesAlimentares_${stamp}.xlsx`);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      {graves.length > 0 && (
        <Card className="border-l-4 border-l-destructive bg-destructive/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold text-destructive">Atenção: {graves.length} participante(s) com restrição grave</p>
              <p className="text-sm">Verifique alergias com risco de anafilaxia antes de planejar refeições. Mantenha protocolo de emergência acessível.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-48"><Label className="text-xs">Buscar</Label><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, restrição, bairro…"/></div>
        <div className="w-40"><Label className="text-xs">Período</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="todos">Todos</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="integral">Integral</option>
          </select>
        </div>
        <Button variant="outline" onClick={exportXLSX}><Download className="h-4 w-4 mr-2"/>Exportar XLSX</Button>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} participante(s) com restrição alimentar / saúde</p>

      <Tabs defaultValue="dia">
        <TabsList>
          <TabsTrigger value="dia">Por Dia da Semana</TabsTrigger>
          <TabsTrigger value="restricao">Por Restrição</TabsTrigger>
          <TabsTrigger value="tabela">Tabela completa</TabsTrigger>
        </TabsList>

        <TabsContent value="dia" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {DIAS_SEMANA.map(d => {
              const lista = filtered.filter(p => p.dias_frequenta.includes(d.key));
              return (
                <Card key={d.num}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{d.label} <span className="text-muted-foreground font-normal">({lista.length})</span></CardTitle></CardHeader>
                  <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {lista.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : lista.map(p => <PartCard key={p.id} p={p}/>)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="restricao" className="mt-4">
          {(() => {
            const groups: Record<string, ParticipanteRestricao[]> = {};
            filtered.forEach(p => {
              const cat = getCategoriaRestricao(p.restricao_alimentar).label;
              (groups[cat] ??= []).push(p);
            });
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(groups).sort((a,b) => b[1].length - a[1].length).map(([cat, lista]) => (
                  <Card key={cat}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">{cat} <span className="text-muted-foreground font-normal">({lista.length})</span></CardTitle></CardHeader>
                    <CardContent className="space-y-2">{lista.map(p => <PartCard key={p.id} p={p}/>)}</CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}
        </TabsContent>

        <TabsContent value="tabela" className="mt-4">
          <Card><CardContent className="pt-6">
            <DataTable
              data={filtered as any[]}
              columns={[
                { key: "nome", label: "Nome", sortable: true },
                { key: "idade", label: "Idade", render: r => r.idade ?? "—" },
                { key: "periodo", label: "Período" },
                { key: "bairro", label: "Bairro", render: r => r.bairro ?? "—" },
                { key: "restricao_alimentar", label: "Restrição", render: r => <span className="text-xs">{r.restricao_alimentar ?? "—"}</span> },
                { key: "dias_frequenta", label: "Dias", render: r => (r.dias_frequenta as string[]).join(", ") },
                { key: "turmas", label: "Turmas", render: r => (r.turmas as any[]).map(t => t.nome).join(", ") || "—" },
              ] as Column<any>[]}
            />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PartCard({ p }: { p: ParticipanteRestricao }) {
  const cat = getCategoriaRestricao(p.restricao_alimentar);
  return (
    <div className={`border-l-4 ${COR_BORDER[cat.cor]} bg-muted/30 rounded p-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{p.nome}</p>
          <p className="text-xs text-muted-foreground">
            {p.idade ? `${p.idade}a` : "?"} · {p.periodo ?? "—"}
            {p.sem_turma && <span className="text-amber-600 ml-1">(sem turma)</span>}
          </p>
        </div>
        <Badge className={`${COR_BADGE[cat.cor]} text-[10px] flex-shrink-0`}>{cat.label}</Badge>
      </div>
      {p.restricao_alimentar && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs mt-1 line-clamp-2 cursor-help flex items-start gap-1"><Info className="h-3 w-3 flex-shrink-0 mt-0.5"/>{p.restricao_alimentar}</p>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs"><p className="text-xs whitespace-pre-wrap">{p.restricao_alimentar}</p></TooltipContent>
        </Tooltip>
      )}
      {p.remedio_continuo && (
        <p className="text-xs mt-1 text-amber-700 flex items-start gap-1"><Pill className="h-3 w-3 flex-shrink-0 mt-0.5"/>{p.remedio_continuo}</p>
      )}
      {p.outras_condicoes && (
        <p className="text-[11px] mt-1 text-muted-foreground italic">{p.outras_condicoes}</p>
      )}
    </div>
  );
}