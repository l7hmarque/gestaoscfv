import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, Column } from "@/components/DataTable";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useBackupExport } from "@/hooks/useBackupExport";
import { exportXLSX, exportPDF } from "@/hooks/useDataExport";
import { useAuth } from "@/contexts/AuthContext";
import { Download, FileSpreadsheet, FileText, Archive, Loader2, Trash2 } from "lucide-react";
import { displayCPF, displayPhone } from "@/lib/utils";
import { STATUS_LABELS, PERIODO_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusLabel = STATUS_LABELS;
const periodoLabel = PERIODO_LABELS;

// Maps tab name to supabase table and cascade tables
const TAB_TABLE_MAP: Record<string, { table: string; cascade?: { table: string; fk: string }[] }> = {
  participantes: {
    table: "participantes",
    cascade: [
      { table: "turma_participantes", fk: "participante_id" },
      { table: "presenca", fk: "participante_id" },
      { table: "relatorio_presenca", fk: "participante_id" },
      { table: "atendimentos", fk: "participante_id" },
      { table: "busca_ativa_registros", fk: "participante_id" },
      { table: "participante_documentos", fk: "participante_id" },
      { table: "participante_transferencias", fk: "participante_id" },
    ],
  },
  turmas: {
    table: "turmas",
    cascade: [
      { table: "turma_participantes", fk: "turma_id" },
      { table: "presenca", fk: "turma_id" },
      { table: "relatorio_turmas", fk: "turma_id" },
      { table: "planejamento_turmas", fk: "turma_id" },
      { table: "chamadas_assinadas", fk: "turma_id" },
    ],
  },
  presenca: { table: "presenca" },
  relatorios: {
    table: "relatorios_atividade",
    cascade: [
      { table: "relatorio_fotos", fk: "relatorio_id" },
      { table: "relatorio_presenca", fk: "relatorio_id" },
      { table: "relatorio_turmas", fk: "relatorio_id" },
      { table: "relato_equipe_tecnica", fk: "relatorio_id" },
    ],
  },
  planejamentos: {
    table: "planejamentos",
    cascade: [
      { table: "planejamento_turmas", fk: "planejamento_id" },
    ],
  },
  profissionais: { table: "profiles" },
  despesas: {
    table: "despesas",
    cascade: [
      { table: "despesa_historico", fk: "despesa_id" },
    ],
  },
  categorias: { table: "categorias_financeiras" },
  parcelas: { table: "parcelas_financeiras" },
  estornos: { table: "estornos" },
  orcamentos: {
    table: "orcamentos",
    cascade: [
      { table: "despesas", fk: "orcamento_id" },
      { table: "orcamento_itens", fk: "orcamento_id" },
      { table: "orcamento_cotacoes", fk: "orcamento_id" },
    ],
  },
};

export default function BancoDadosPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("participantes");
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [planejamentos, setPlanejamentos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [parcelas, setParcelas] = useState<any[]>([]);
  const [estornos, setEstornos] = useState<any[]>([]);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCoord, setIsCoord] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Backup
  const { doBackup, loading: backupLoading } = useBackupExport();
  const [backupCats, setBackupCats] = useState<string[]>(["Participantes", "Turmas", "Presenca", "Relatorios", "Planejamentos", "Profissionais", "Despesas", "Categorias", "Parcelas", "Estornos", "Orcamentos"]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { loadAll(); }, []);

  // Check if user is coordenacao
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsCoord((data || []).some((r: any) => r.role === "coordenacao"));
    });
  }, [user]);

  // Clear selection when tab changes
  useEffect(() => { setSelectedIds(new Set()); }, [tab]);

  const loadAll = async () => {
    setLoading(true);
    const [p, t, pr, r, pl, prof, desp, cats, parc, est, orc] = await Promise.all([
      fetchAllRows("participantes", { select: "*", order: { column: "nome_completo" } }),
      fetchAllRows("turmas", { select: "*, profiles!turmas_educador_id_fkey(nome)", order: { column: "nome" } }),
      fetchAllRows("presenca", { select: "*, participantes(nome_completo), turmas(nome)", order: { column: "data", ascending: false } }),
      fetchAllRows("relatorios_atividade", { select: "*, profiles!relatorios_atividade_educador_id_fkey(nome)", order: { column: "data", ascending: false } }),
      fetchAllRows("planejamentos", { select: "*, profiles!planejamentos_educador_id_fkey(nome)", order: { column: "created_at", ascending: false } }),
      fetchAllRows("profiles", { select: "*", order: { column: "nome" } }),
      fetchAllRows("despesas", { select: "*, categorias_financeiras(descricao)", order: { column: "data_lancamento", ascending: false } }),
      fetchAllRows("categorias_financeiras", { select: "*", order: { column: "codigo" } }),
      fetchAllRows("parcelas_financeiras", { select: "*", order: { column: "numero_parcela" } }),
      fetchAllRows("estornos", { select: "*, categorias_financeiras(descricao)", order: { column: "mes_referencia", ascending: false } }),
      fetchAllRows("orcamentos", { select: "*, categorias_financeiras(descricao)", order: { column: "created_at", ascending: false } }),
    ]);
    const { data: roles } = await supabase.from("user_roles").select("*");
    const roleMap = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    setParticipantes(p || []);
    setTurmas(t || []);
    setPresenca((pr || []).map((x: any) => ({ ...x, participante_nome: x.participantes?.nome_completo || "", turma_nome: x.turmas?.nome || "", presente_str: x.presente ? "Sim" : "Não" })));
    setRelatorios((r || []).map((x: any) => ({ ...x, educador_nome: x.profiles?.nome || "" })));
    setPlanejamentos((pl || []).map((x: any) => ({ ...x, educador_nome: x.profiles?.nome || "", avaliacao_str: x.forma_avaliacao?.join(", ") || "" })));
    setProfissionais((prof || []).map((x: any) => ({ ...x, roles_str: (roleMap.get(x.user_id) || []).join(", "), ativo_str: x.ativo ? "Sim" : "Não" })));
    setDespesas((desp || []).map((x: any) => ({ ...x, categoria_nome: x.categorias_financeiras?.descricao || "—", valor_fmt: `R$ ${Number(x.valor || 0).toFixed(2)}` })));
    setCategorias((cats || []).map((x: any) => ({ ...x, valor_fmt: x.valor_previsto != null ? `R$ ${Number(x.valor_previsto).toFixed(2)}` : "—" })));
    setParcelas((parc || []).map((x: any) => ({ ...x, valor_fmt: `R$ ${Number(x.valor || 0).toFixed(2)}` })));
    setEstornos((est || []).map((x: any) => ({ ...x, categoria_nome: x.categorias_financeiras?.descricao || "—", valor_fmt: `R$ ${Number(x.valor || 0).toFixed(2)}` })));
    setOrcamentos((orc || []).map((x: any) => ({ ...x, categoria_nome: x.categorias_financeiras?.descricao || "—" })));
    setLoading(false);
  };

  const toggleCat = (cat: string) => setBackupCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const config = TAB_TABLE_MAP[tab];
      if (!config) throw new Error("Tab inválida");

      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);

        if (config.cascade) {
          for (const c of config.cascade) {
            await (supabase.from as any)(c.table).delete().in(c.fk, batch);
          }
        }

        await (supabase.from as any)(config.table).delete().in("id", batch);
      }

      toast.success(`${ids.length} registro(s) excluído(s)`);
      setSelectedIds(new Set());
      await loadAll();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "desconhecido"));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const partCols: Column<any>[] = [
    { key: "nome_completo", label: "Nome" },
    { key: "data_nascimento", label: "Nascimento" },
    { key: "genero", label: "Gênero" },
    { key: "periodo", label: "Período", render: r => periodoLabel[r.periodo] || r.periodo || "—" },
    { key: "status", label: "Status", render: r => <Badge variant={r.status === "ativo" ? "default" : "secondary"} className="text-[10px]">{statusLabel[r.status] || r.status}</Badge> },
    { key: "escola", label: "Escola" },
    { key: "endereco_bairro", label: "Bairro" },
    { key: "responsavel1_nome", label: "Responsável" },
    { key: "cpf", label: "CPF", render: (r: any) => displayCPF(r.cpf) },
    { key: "responsavel1_whatsapp", label: "WhatsApp", render: (r: any) => displayPhone(r.responsavel1_whatsapp) },
  ];
  const partHeaders = partCols.map(c => ({ key: c.key, label: c.label }));

  const turmaCols: Column<any>[] = [
    { key: "nome", label: "Nome" },
    { key: "tipo", label: "Tipo", render: r => r.tipo === "ordinaria" ? "Ordinária" : "Extraordinária" },
    { key: "periodo", label: "Período", render: r => periodoLabel[r.periodo] || "—" },
    { key: "faixa_etaria", label: "Faixa Etária" },
    { key: "dias_semana", label: "Dias", render: r => r.dias_semana?.join(", ") || "—" },
    { key: "educador_nome", label: "Educador", render: r => r.profiles?.nome || "—" },
    { key: "ativa", label: "Ativa", render: r => r.ativa ? "Sim" : "Não" },
  ];

  const presencaCols: Column<any>[] = [
    { key: "data", label: "Data" },
    { key: "turma_nome", label: "Turma" },
    { key: "participante_nome", label: "Participante" },
    { key: "presente_str", label: "Presente" },
    { key: "justificativa", label: "Justificativa" },
  ];

  const relCols: Column<any>[] = [
    { key: "data", label: "Data" },
    { key: "nome_atividade", label: "Atividade" },
    { key: "educador_nome", label: "Educador" },
    { key: "score_elo", label: "Score ELO", render: r => r.score_elo != null ? Number(r.score_elo).toFixed(2) : "—" },
    { key: "pct_adesao", label: "% Adesão", render: r => r.pct_adesao != null ? `${Number(r.pct_adesao).toFixed(0)}%` : "—" },
    { key: "num_participantes", label: "Participantes" },
    { key: "objetivo_alcancado", label: "Objetivo" },
  ];

  const planCols: Column<any>[] = [
    { key: "titulo", label: "Título" },
    { key: "tema", label: "Tema" },
    { key: "educador_nome", label: "Educador" },
    { key: "data_aplicacao", label: "Data Aplicação" },
    { key: "avaliacao_str", label: "Avaliação" },
  ];

  const profCols: Column<any>[] = [
    { key: "nome", label: "Nome" },
    { key: "cargo", label: "Cargo" },
    { key: "roles_str", label: "Função" },
    { key: "ativo_str", label: "Ativo" },
  ];

  const despesaCols: Column<any>[] = [
    { key: "data_lancamento", label: "Data" },
    { key: "descricao", label: "Descrição" },
    { key: "fornecedor", label: "Fornecedor" },
    { key: "valor_fmt", label: "Valor" },
    { key: "categoria_nome", label: "Categoria" },
    { key: "mes_referencia", label: "Mês Ref." },
    { key: "status_sit", label: "Status", render: r => <Badge variant={r.status_sit === "pago" ? "default" : "secondary"} className="text-[10px]">{r.status_sit || "pendente"}</Badge> },
    { key: "numero_documento", label: "Nº Doc" },
  ];

  const categoriaCols: Column<any>[] = [
    { key: "codigo", label: "Código" },
    { key: "descricao", label: "Descrição" },
    { key: "valor_fmt", label: "Valor Previsto" },
  ];

  const parcelaCols: Column<any>[] = [
    { key: "numero_parcela", label: "Parcela" },
    { key: "data_recebimento", label: "Data Recebimento" },
    { key: "valor_fmt", label: "Valor" },
  ];

  const estornoCols: Column<any>[] = [
    { key: "mes_referencia", label: "Mês Ref." },
    { key: "categoria_nome", label: "Categoria" },
    { key: "valor_fmt", label: "Valor" },
  ];

  const orcamentoCols: Column<any>[] = [
    { key: "titulo", label: "Título" },
    { key: "objeto", label: "Objeto" },
    { key: "mes_referencia", label: "Mês Ref." },
    { key: "categoria_nome", label: "Categoria" },
    { key: "status", label: "Status", render: r => <Badge variant={r.status === "aprovado" ? "default" : "secondary"} className="text-[10px]">{r.status}</Badge> },
    { key: "fornecedor_vencedor", label: "Fornecedor" },
  ];

  const getActiveData = () => {
    switch (tab) {
      case "participantes": return { data: participantes, headers: partHeaders, label: "Participantes" };
      case "turmas": return { data: turmas, headers: turmaCols.map(c => ({ key: c.key, label: c.label })), label: "Turmas" };
      case "presenca": return { data: presenca, headers: presencaCols.map(c => ({ key: c.key, label: c.label })), label: "Presenca" };
      case "relatorios": return { data: relatorios, headers: relCols.map(c => ({ key: c.key, label: c.label })), label: "Relatorios" };
      case "planejamentos": return { data: planejamentos, headers: planCols.map(c => ({ key: c.key, label: c.label })), label: "Planejamentos" };
      case "profissionais": return { data: profissionais, headers: profCols.map(c => ({ key: c.key, label: c.label })), label: "Profissionais" };
      case "despesas": return { data: despesas, headers: despesaCols.map(c => ({ key: c.key, label: c.label })), label: "Despesas" };
      case "categorias": return { data: categorias, headers: categoriaCols.map(c => ({ key: c.key, label: c.label })), label: "Categorias" };
      case "parcelas": return { data: parcelas, headers: parcelaCols.map(c => ({ key: c.key, label: c.label })), label: "Parcelas" };
      case "estornos": return { data: estornos, headers: estornoCols.map(c => ({ key: c.key, label: c.label })), label: "Estornos" };
      case "orcamentos": return { data: orcamentos, headers: orcamentoCols.map(c => ({ key: c.key, label: c.label })), label: "Orcamentos" };
      default: return { data: [], headers: [], label: "" };
    }
  };

  const handleExport = (format: "xlsx" | "pdf") => {
    const { data, headers, label } = getActiveData();
    if (!data.length) return;
    if (format === "xlsx") exportXLSX(data, headers, label);
    else exportPDF(data, headers, label);
  };

  const getActiveCols = () => {
    switch (tab) {
      case "participantes": return partCols;
      case "turmas": return turmaCols;
      case "presenca": return presencaCols;
      case "relatorios": return relCols;
      case "planejamentos": return planCols;
      case "profissionais": return profCols;
      case "despesas": return despesaCols;
      case "categorias": return categoriaCols;
      case "parcelas": return parcelaCols;
      case "estornos": return estornoCols;
      case "orcamentos": return orcamentoCols;
      default: return [];
    }
  };

  const getActiveDataList = () => {
    switch (tab) {
      case "participantes": return participantes;
      case "turmas": return turmas;
      case "presenca": return presenca;
      case "relatorios": return relatorios;
      case "planejamentos": return planejamentos;
      case "profissionais": return profissionais;
      case "despesas": return despesas;
      case "categorias": return categorias;
      case "parcelas": return parcelas;
      case "estornos": return estornos;
      case "orcamentos": return orcamentos;
      default: return [];
    }
  };

  const allCats = ["Participantes", "Turmas", "Presenca", "Relatorios", "Planejamentos", "Profissionais", "Despesas", "Categorias", "Parcelas", "Estornos", "Orcamentos"];

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Carregando dados...</div>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Banco de Dados</h1>
          <p className="text-xs text-muted-foreground">Visualize, busque e exporte todos os dados do sistema</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="participantes" className="text-xs px-3 h-7">Participantes</TabsTrigger>
            <TabsTrigger value="turmas" className="text-xs px-3 h-7">Turmas</TabsTrigger>
            <TabsTrigger value="presenca" className="text-xs px-3 h-7">Presença</TabsTrigger>
            <TabsTrigger value="relatorios" className="text-xs px-3 h-7">Relatórios</TabsTrigger>
            <TabsTrigger value="planejamentos" className="text-xs px-3 h-7">Planejamentos</TabsTrigger>
            <TabsTrigger value="profissionais" className="text-xs px-3 h-7">Profissionais</TabsTrigger>
            <TabsTrigger value="despesas" className="text-xs px-3 h-7">Despesas</TabsTrigger>
            <TabsTrigger value="categorias" className="text-xs px-3 h-7">Categorias</TabsTrigger>
            <TabsTrigger value="parcelas" className="text-xs px-3 h-7">Parcelas</TabsTrigger>
            <TabsTrigger value="estornos" className="text-xs px-3 h-7">Estornos</TabsTrigger>
            <TabsTrigger value="orcamentos" className="text-xs px-3 h-7">Orçamentos</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {isCoord && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={deleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir {selectedIds.size}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Exportar aba
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport("xlsx")} className="text-xs gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="text-xs gap-2">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {["participantes", "turmas", "presenca", "relatorios", "planejamentos", "profissionais", "despesas", "categorias", "parcelas", "estornos", "orcamentos"].map(tabKey => (
          <TabsContent key={tabKey} value={tabKey}>
            <DataTable
              data={getActiveDataList()}
              columns={getActiveCols()}
              searchPlaceholder={`Buscar ${tabKey}...`}
              selectable={isCoord}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Backup em massa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Archive className="h-4 w-4" /> Backup / Exportação em Massa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allCats.map(cat => (
              <label key={cat} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={backupCats.includes(cat)} onCheckedChange={() => toggleCat(cat)} />
                {cat}
              </label>
            ))}
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Data início</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data fim</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5" disabled={backupLoading || !backupCats.length} onClick={() => doBackup(backupCats, dateFrom || undefined, dateTo || undefined)}>
              {backupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              {backupLoading ? "Gerando..." : "Gerar Backup ZIP"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">O arquivo ZIP conterá pastas por categoria com dados em XLSX. Padrão: SysELO_Backup_YYYY-MM-DD_HHmmss.zip</p>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong> registro(s) da aba <strong>{tab}</strong>?
              {TAB_TABLE_MAP[tab]?.cascade && (
                <span className="block mt-1 text-destructive">Dados relacionados (presenças, vínculos, fotos, etc.) também serão removidos.</span>
              )}
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
