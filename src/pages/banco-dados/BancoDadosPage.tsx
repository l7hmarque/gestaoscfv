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
import { Download, FileSpreadsheet, FileText, Archive, Loader2 } from "lucide-react";
import { displayCPF, displayPhone } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusLabel: Record<string, string> = { ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto" };
const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

export default function BancoDadosPage() {
  const [tab, setTab] = useState("participantes");
  const [participantes, setParticipantes] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [presenca, setPresenca] = useState<any[]>([]);
  const [relatorios, setRelatorios] = useState<any[]>([]);
  const [planejamentos, setPlanejamentos] = useState<any[]>([]);
  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Backup
  const { doBackup, loading: backupLoading } = useBackupExport();
  const [backupCats, setBackupCats] = useState<string[]>(["Participantes", "Turmas", "Presenca", "Relatorios", "Planejamentos", "Profissionais"]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [p, t, pr, r, pl, prof] = await Promise.all([
      fetchAllRows("participantes", { select: "*", order: { column: "nome_completo" } }),
      fetchAllRows("turmas", { select: "*, profiles!turmas_educador_id_fkey(nome)", order: { column: "nome" } }),
      fetchAllRows("presenca", { select: "*, participantes(nome_completo), turmas(nome)", order: { column: "data", ascending: false } }),
      fetchAllRows("relatorios_atividade", { select: "*, profiles!relatorios_atividade_educador_id_fkey(nome)", order: { column: "data", ascending: false } }),
      fetchAllRows("planejamentos", { select: "*, profiles!planejamentos_educador_id_fkey(nome)", order: { column: "created_at", ascending: false } }),
      fetchAllRows("profiles", { select: "*", order: { column: "nome" } }),
    ]);
    // Fetch user_roles separately since FK goes to auth.users, not profiles
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
    setLoading(false);
  };

  const toggleCat = (cat: string) => setBackupCats(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const partCols: Column<any>[] = [
    { key: "nome_completo", label: "Nome" },
    { key: "data_nascimento", label: "Nascimento" },
    { key: "genero", label: "Gênero" },
    { key: "periodo", label: "Período", render: r => periodoLabel[r.periodo] || r.periodo || "—" },
    { key: "status", label: "Status", render: r => <Badge variant={r.status === "ativo" ? "default" : "secondary"} className="text-[10px]">{statusLabel[r.status] || r.status}</Badge> },
    { key: "escola", label: "Escola" },
    { key: "endereco_bairro", label: "Bairro" },
    { key: "responsavel1_nome", label: "Responsável" },
    { key: "responsavel1_whatsapp", label: "WhatsApp" },
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

  const getActiveData = () => {
    switch (tab) {
      case "participantes": return { data: participantes, headers: partHeaders, label: "Participantes" };
      case "turmas": return { data: turmas, headers: turmaCols.map(c => ({ key: c.key, label: c.label })), label: "Turmas" };
      case "presenca": return { data: presenca, headers: presencaCols.map(c => ({ key: c.key, label: c.label })), label: "Presenca" };
      case "relatorios": return { data: relatorios, headers: relCols.map(c => ({ key: c.key, label: c.label })), label: "Relatorios" };
      case "planejamentos": return { data: planejamentos, headers: planCols.map(c => ({ key: c.key, label: c.label })), label: "Planejamentos" };
      case "profissionais": return { data: profissionais, headers: profCols.map(c => ({ key: c.key, label: c.label })), label: "Profissionais" };
      default: return { data: [], headers: [], label: "" };
    }
  };

  const handleExport = (format: "xlsx" | "pdf") => {
    const { data, headers, label } = getActiveData();
    if (!data.length) return;
    if (format === "xlsx") exportXLSX(data, headers, label);
    else exportPDF(data, headers, label);
  };

  const allCats = ["Participantes", "Turmas", "Presenca", "Relatorios", "Planejamentos", "Profissionais"];

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
          <TabsList className="h-8">
            <TabsTrigger value="participantes" className="text-xs px-3 h-7">Participantes</TabsTrigger>
            <TabsTrigger value="turmas" className="text-xs px-3 h-7">Turmas</TabsTrigger>
            <TabsTrigger value="presenca" className="text-xs px-3 h-7">Presença</TabsTrigger>
            <TabsTrigger value="relatorios" className="text-xs px-3 h-7">Relatórios</TabsTrigger>
            <TabsTrigger value="planejamentos" className="text-xs px-3 h-7">Planejamentos</TabsTrigger>
            <TabsTrigger value="profissionais" className="text-xs px-3 h-7">Profissionais</TabsTrigger>
          </TabsList>

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

        <TabsContent value="participantes"><DataTable data={participantes} columns={partCols} searchPlaceholder="Buscar participante..." /></TabsContent>
        <TabsContent value="turmas"><DataTable data={turmas} columns={turmaCols} searchPlaceholder="Buscar turma..." /></TabsContent>
        <TabsContent value="presenca"><DataTable data={presenca} columns={presencaCols} searchPlaceholder="Buscar presença..." /></TabsContent>
        <TabsContent value="relatorios"><DataTable data={relatorios} columns={relCols} searchPlaceholder="Buscar relatório..." /></TabsContent>
        <TabsContent value="planejamentos"><DataTable data={planejamentos} columns={planCols} searchPlaceholder="Buscar planejamento..." /></TabsContent>
        <TabsContent value="profissionais"><DataTable data={profissionais} columns={profCols} searchPlaceholder="Buscar profissional..." /></TabsContent>
      </Tabs>

      {/* Backup em massa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Archive className="h-4 w-4" /> Backup / Exportação em Massa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
    </div>
  );
}
