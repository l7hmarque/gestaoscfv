import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Loader2, RefreshCw, ArrowRightCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FAIXA_LABELS, PERIODO_LABELS } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";

type Row = {
  vinculo_id: string;
  participante_id: string;
  nome_completo: string;
  idade: number;
  faixa_atual: string;
  participante_bairro_id: string | null;
  participante_periodo: string | null;
  turma_id: string;
  turma_nome: string;
  turma_faixa_etaria: string | null;
  turma_periodo: string | null;
  data_entrada: string | null;
  dias_no_vinculo: number | null;
};

type TurmaDestino = { id: string; nome: string; oficina: string | null };

export default function TurmasForaFaixaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [faixaFiltro, setFaixaFiltro] = useState<string>("todas");
  const [destinosPorLinha, setDestinosPorLinha] = useState<Record<string, TurmaDestino[]>>({});
  const [destinoSelecionado, setDestinoSelecionado] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const isDemo = useIsDemo();

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("vw_participantes_fora_faixa")
      .select("*")
      .order("dias_no_vinculo", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar: " + error.message);
      setLoading(false);
      return;
    }
    const list = (data || []) as Row[];
    setRows(list);

    // Pré-carrega turmas compatíveis por linha (mesma oficina/SCFV, bairro do participante, período, faixa atual)
    const destMap: Record<string, TurmaDestino[]> = {};
    for (const r of list) {
      if (!r.participante_bairro_id) continue;
      const { data: tDest } = await supabase
        .from("turmas")
        .select("id, nome, oficina, faixa_etaria, faixas_etarias, bairro_id, bairro_ids, periodo, ativa")
        .eq("ativa", true)
        .neq("id", r.turma_id);
      const compativeis = (tDest || []).filter((t: any) => {
        const faixaOk = t.faixa_etaria === r.faixa_atual || (Array.isArray(t.faixas_etarias) && t.faixas_etarias.includes(r.faixa_atual));
        const bairroOk = t.bairro_id === r.participante_bairro_id || (Array.isArray(t.bairro_ids) && t.bairro_ids.includes(r.participante_bairro_id));
        const periodoOk = !r.participante_periodo || t.periodo === r.participante_periodo || t.periodo === "integral";
        return faixaOk && bairroOk && periodoOk;
      });
      destMap[r.vinculo_id] = compativeis.map((t: any) => ({ id: t.id, nome: t.nome, oficina: t.oficina || null }));
    }
    setDestinosPorLinha(destMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (faixaFiltro !== "todas" && r.faixa_atual !== faixaFiltro) return false;
      if (busca && !r.nome_completo.toLowerCase().includes(busca.toLowerCase()) && !r.turma_nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [rows, busca, faixaFiltro]);

  const handleRemover = async (r: Row) => {
    if (guardDemo(isDemo)) return;
    if (!confirm(`Remover ${r.nome_completo} da turma "${r.turma_nome}"?\n\nO participante NÃO será desligado — apenas o vínculo com esta turma será encerrado.`)) return;
    setBusy(r.vinculo_id);
    const today = new Date().toISOString().split("T")[0];
    const { error } = await (supabase.from("turma_participantes") as any)
      .update({ data_saida: today, motivo_saida: `Fora da faixa etária (${r.idade}a · turma ${r.turma_faixa_etaria || "—"})` })
      .eq("id", r.vinculo_id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Vínculo encerrado");
    fetchData();
  };

  const handleTransferir = async (r: Row) => {
    if (guardDemo(isDemo)) return;
    const destinoId = destinoSelecionado[r.vinculo_id];
    if (!destinoId) { toast.error("Escolha uma turma de destino"); return; }
    setBusy(r.vinculo_id);
    const today = new Date().toISOString().split("T")[0];

    // 1. Encerra vínculo antigo
    const { error: e1 } = await (supabase.from("turma_participantes") as any)
      .update({ data_saida: today, motivo_saida: `Transferido por mudança de faixa etária (→ ${r.faixa_atual})` })
      .eq("id", r.vinculo_id);
    if (e1) { setBusy(null); toast.error(e1.message); return; }

    // 2. Cria novo vínculo
    const { error: e2 } = await supabase.from("turma_participantes")
      .insert({ turma_id: destinoId, participante_id: r.participante_id } as any);
    if (e2 && !e2.message.includes("duplicate")) { setBusy(null); toast.error(e2.message); return; }

    // 3. Registra transferência para histórico
    await (supabase.from("participante_transferencias") as any).insert({
      participante_id: r.participante_id,
      turma_origem_id: r.turma_id,
      turma_destino_id: destinoId,
      motivo: `Mudança de faixa etária (idade atual ${r.idade}a)`,
    });

    setBusy(null);
    toast.success("Transferência concluída");
    fetchData();
  };

  const totalUnicos = new Set(rows.map(r => r.participante_id)).size;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" asChild><Link to="/turmas"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Participantes fora da faixa etária
            </h1>
            <p className="text-xs text-muted-foreground">
              {totalUnicos} participante(s) em {rows.length} vínculo(s) com faixa incompatível com a idade atual.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-3.5 w-3.5 mr-1" />Atualizar</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input placeholder="Buscar nome ou turma..." value={busca} onChange={e => setBusca(e.target.value)} className="max-w-xs h-9" />
          <Select value={faixaFiltro} onValueChange={setFaixaFiltro}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as faixas</SelectItem>
              <SelectItem value="6-8">6 a 8 anos</SelectItem>
              <SelectItem value="9-11">9 a 11 anos</SelectItem>
              <SelectItem value="12-17">12 a 17 anos</SelectItem>
              <SelectItem value="idosos">Idosos (60+)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-sm text-muted-foreground">
              {rows.length === 0 ? "🎉 Nenhum participante fora da faixa etária." : "Nenhum resultado com os filtros atuais."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Participante</TableHead>
                    <TableHead className="text-xs">Idade</TableHead>
                    <TableHead className="text-xs">Turma atual</TableHead>
                    <TableHead className="text-xs">Faixa correta</TableHead>
                    <TableHead className="text-xs">Dias fora</TableHead>
                    <TableHead className="text-xs">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const destinos = destinosPorLinha[r.vinculo_id] || [];
                    const isBusy = busy === r.vinculo_id;
                    return (
                      <TableRow key={r.vinculo_id}>
                        <TableCell className="text-xs sm:text-sm">
                          <Link to={`/participantes/${r.participante_id}`} className="hover:underline text-foreground font-medium">
                            {r.nome_completo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs"><Badge variant="outline">{r.idade}a</Badge></TableCell>
                        <TableCell className="text-xs">
                          <Link to={`/turmas/${r.turma_id}`} className="hover:underline text-muted-foreground">
                            {r.turma_nome}
                          </Link>
                          {r.turma_faixa_etaria && <span className="text-[10px] text-muted-foreground ml-1">({FAIXA_LABELS[r.turma_faixa_etaria] || r.turma_faixa_etaria})</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="secondary" className="text-[10px]">{FAIXA_LABELS[r.faixa_atual] || r.faixa_atual}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.dias_no_vinculo ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                            {destinos.length > 0 ? (
                              <>
                                <Select
                                  value={destinoSelecionado[r.vinculo_id] || ""}
                                  onValueChange={(v) => setDestinoSelecionado(s => ({ ...s, [r.vinculo_id]: v }))}
                                  disabled={isBusy}
                                >
                                  <SelectTrigger className="h-7 text-[11px] min-w-[180px]">
                                    <SelectValue placeholder="Escolher turma compatível..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {destinos.map(d => (
                                      <SelectItem key={d.id} value={d.id} className="text-xs">
                                        {d.oficina ? `[${d.oficina}] ` : ""}{d.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" variant="default" className="h-7 px-2" disabled={isBusy || !destinoSelecionado[r.vinculo_id]} onClick={() => handleTransferir(r)}>
                                  <ArrowRightCircle className="h-3.5 w-3.5 mr-1" />Transferir
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Sem turma compatível</span>
                            )}
                            <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" disabled={isBusy} onClick={() => handleRemover(r)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />Remover
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Esta lista detecta automaticamente participantes que mudaram de faixa etária (ex.: completaram 12 anos enquanto estavam em turma 9-11). <strong>Nenhuma transferência acontece sem sua confirmação.</strong>
      </p>
    </div>
  );
}