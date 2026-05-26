import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Trash2, Search, Filter, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import { calcFaixaFromDate, displayAge, PERIODO_LABELS, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

const MOTIVOS = [
  "Mudança de município",
  "Evasão",
  "Desistência",
  "Completou a faixa etária",
  "Transferência para outro serviço",
  "Nunca frequentou",
  "Outro",
];

const PainelDesligamentoPage = () => {
  const { user } = useAuth();
  const { log: auditLog } = useAuditLog();
  const [participantes, setParticipantes] = useState<Tables<"participantes">[]>([]);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [bairroFilter, setBairroFilter] = useState<string>("");
  const [periodoFilter, setPeriodoFilter] = useState<string>("");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Desligamento config
  const [motivo, setMotivo] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [dataDesligamento, setDataDesligamento] = useState(new Date().toISOString().slice(0, 10));

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [p, { data: b }] = await Promise.all([
      fetchAllRows("participantes", { select: "*", order: { column: "nome_completo" } }),
      supabase.from("bairros").select("*").order("nome"),
    ]);
    setParticipantes(p.filter((x: any) => x.status === "ativo" || x.status === "busca_ativa"));
    setBairros(b || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let list = participantes;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => p.nome_completo.toLowerCase().includes(s));
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    if (bairroFilter) list = list.filter(p => p.bairro_id === bairroFilter);
    if (periodoFilter) list = list.filter(p => p.periodo === periodoFilter);
    return list;
  }, [participantes, search, statusFilter, bairroFilter, periodoFilter]);

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
    }
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const bairroName = (id: string | null) => bairros.find(b => b.id === id)?.nome || "—";

  const handleExecute = async () => {
    setConfirmOpen(false);
    setProcessing(true);
    const ids = Array.from(selected);
    let success = 0;
    let errors = 0;

    for (const pid of ids) {
      try {
        // 1. Update participant status
        const updatePayload: Record<string, any> = {
          status: "desligado" as any,
          data_desligamento: dataDesligamento || null,
          motivo_desligamento: motivo || null,
          justificativa_desligamento: justificativa || null,
        };
        const { error: e1 } = await supabase.from("participantes").update(updatePayload).eq("id", pid);
        if (e1) throw e1;

        // 2. Remove turma_participantes
        await supabase.from("turma_participantes").delete().eq("participante_id", pid);

        // 3. Remove relatorio_presenca
        await supabase.from("relatorio_presenca").delete().eq("participante_id", pid);

        // 4. Remove presenca
        await supabase.from("presenca").delete().eq("participante_id", pid);

        // 5. Audit log
        await auditLog({
          acao: "desligamento_lote",
          tabela: "participantes",
          registro_id: pid,
          detalhes: `Desligamento em lote. Motivo: ${motivo || "N/A"}`,
          justificativa: justificativa || undefined,
        });

        success++;
      } catch (err) {
        console.error("Erro ao desligar participante", pid, err);
        errors++;
      }
    }

    toast.success(`${success} participante(s) desligado(s) com sucesso.${errors > 0 ? ` ${errors} erro(s).` : ""}`);
    setSelected(new Set());
    setMotivo("");
    setJustificativa("");
    fetchData();
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/participantes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel de Desligamento</h1>
          <p className="text-sm text-muted-foreground">Desligamento em lote com limpeza de indicadores — apenas Coordenação</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração do Desligamento</CardTitle>
          <CardDescription>Campos aplicados a todos os selecionados. Todos opcionais.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Data de Desligamento</Label>
            <Input type="date" value={dataDesligamento} onChange={e => setDataDesligamento(e.target.value)} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Justificativa</Label>
            <Textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-9"><Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="busca_ativa">Busca Ativa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bairroFilter} onValueChange={v => setBairroFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Bairro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {bairros.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodoFilter} onValueChange={v => setPeriodoFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="manha">Manhã</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
            
          </SelectContent>
        </Select>
      </div>

      {/* Summary + action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} participante(s) exibidos • {selected.size} selecionado(s)
        </p>
        <Button
          variant="destructive"
          disabled={selected.size === 0 || processing}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {processing ? "Processando..." : `Desligar ${selected.size} Selecionado(s)`}
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto max-h-[60vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Faixa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} className={selected.has(p.id) ? "bg-destructive/5" : ""}>
                <TableCell>
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                </TableCell>
                <TableCell className="font-medium">{p.nome_completo}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_COLORS[p.status || "ativo"]}>
                    {STATUS_LABELS[p.status || "ativo"]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{bairroName(p.bairro_id)}</TableCell>
                <TableCell className="text-sm">{PERIODO_LABELS[p.periodo || ""] || "—"}</TableCell>
                <TableCell className="text-sm">{displayAge(p.data_nascimento)}</TableCell>
                <TableCell className="text-sm">{calcFaixaFromDate(p.data_nascimento) || "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum participante encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Desligamento em Lote
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível para os indicadores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><strong>{selected.size}</strong> participante(s) serão desligados.</p>
            <p>Para cada um, serão removidos:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Vínculos com turmas</li>
              <li>Registros de presença (chamada diária)</li>
              <li>Presenças em relatórios de atividade</li>
            </ul>
            <p className="text-destructive font-medium">Os participantes permanecerão no banco como "Desligado".</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExecute}>
              Confirmar Desligamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PainelDesligamentoPage;
