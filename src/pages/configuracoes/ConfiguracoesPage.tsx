import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Save, Building2, MapPin, Users, FileText, Shield, Database, Loader2,
  Bus, UserCog, Download, Clock, ScrollText, Plus, Trash2, Check, X,
  FileCode2, History, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import { useBackupExport } from "@/hooks/useBackupExport";
import TemplateTagMapper from "@/components/TemplateTagMapper";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllRows } from "@/lib/fetchAllRows";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { sysCfvFileName } from "@/lib/fileNaming";
import { autoFitColumns } from "@/lib/xlsxAutoFit";

const CONFIG_KEYS = [
  { key: "nome_entidade", label: "Nome da Entidade", default: "Sociedade Civil Nossa Senhora Aparecida" },
  { key: "nome_centro", label: "Nome do Centro", default: "Centro de Atenção Integral ao Adolescente - Medianeira" },
  { key: "cnpj", label: "CNPJ", default: "" },
  { key: "endereco", label: "Endereço", default: "" },
  { key: "telefone", label: "Telefone", default: "" },
  { key: "email_institucional", label: "E-mail Institucional", default: "" },
  { key: "convenio_numero", label: "Nº do Convênio/Termo", default: "001/2022" },
  { key: "presidente_nome", label: "Nome do Presidente", default: "Raúl Oscar Sena Vélez" },
  { key: "presidente_cpf", label: "CPF do Presidente", default: "801.780.489-09" },
];

const ROLE_LABELS: Record<string, string> = {
  coordenacao: "Coordenação",
  educador: "Educador",
  tecnico: "Equipe Técnica",
  motorista: "Motorista",
  cozinheiro: "Cozinheiro",
  visitante: "Visitante",
  marketing: "Marketing",
};

const ROLE_COLORS: Record<string, string> = {
  coordenacao: "bg-primary/10 text-primary border-primary/20",
  educador: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  tecnico: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  motorista: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  cozinheiro: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  visitante: "bg-muted text-muted-foreground border-border",
  marketing: "bg-pink-500/10 text-pink-700 border-pink-500/20",
};

const BACKUP_CATEGORIES = [
  { key: "Participantes", label: "Participantes" },
  { key: "Turmas", label: "Turmas" },
  { key: "Presenca", label: "Presença" },
  { key: "Relatorios", label: "Relatórios" },
  { key: "Planejamentos", label: "Planejamentos" },
  { key: "Profissionais", label: "Profissionais" },
];

const AUDIT_PAGE_SIZE = 50;

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("instituicao");
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [bairros, setBairros] = useState<any[]>([]);
  const [pontosTransporte, setPontosTransporte] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Audit state
  const [allAuditLogs, setAllAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [auditFilterUser, setAuditFilterUser] = useState("");
  const [auditFilterAcao, setAuditFilterAcao] = useState("");
  const [auditFilterTabela, setAuditFilterTabela] = useState("");
  const [auditFilterDe, setAuditFilterDe] = useState("");
  const [auditFilterAte, setAuditFilterAte] = useState("");

  // Backup state
  const { doBackup, loading: backupLoading } = useBackupExport();
  const [backupCategories, setBackupCategories] = useState<string[]>(BACKUP_CATEGORIES.map(c => c.key));
  const [backupDateFrom, setBackupDateFrom] = useState("");
  const [backupDateTo, setBackupDateTo] = useState("");

  // Template tag mapper
  const [tagMapperOpen, setTagMapperOpen] = useState(false);
  const [tagMapperKey, setTagMapperKey] = useState("");

  // New ponto transporte
  const [newPontoNome, setNewPontoNome] = useState("");
  const [newPontoBairro, setNewPontoBairro] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cfgData }, { data: bData }, { data: ptData }, { data: profData }, { data: rolesData }] = await Promise.all([
      supabase.from("configuracoes_gerais").select("*"),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*, bairros(nome)").order("nome"),
      supabase.from("profiles").select("id, nome, cargo, ativo, user_id, email, telefone, carga_horaria, data_inicio, salario, data_desligamento").order("nome"),
      supabase.from("user_roles").select("*"),
    ]);

    const map: Record<string, string> = {};
    CONFIG_KEYS.forEach(k => { map[k.key] = k.default; });
    (cfgData || []).forEach((c: any) => { map[c.chave] = c.valor || ""; });
    setConfigs(map);
    setBairros(bData || []);
    setPontosTransporte(ptData || []);
    setProfiles(profData || []);
    setUserRoles(rolesData || []);

    // Load templates from storage
    const { data: tplFiles } = await supabase.storage.from("templates").list();
    setTemplates((tplFiles || []).filter(f => f.name.endsWith(".docx")).map(f => f.name));

    setLoading(false);
  };

  // Load audit logs on demand when tab is opened
  const loadAuditLogs = async () => {
    if (allAuditLogs.length > 0) return;
    setAuditLoading(true);
    try {
      const rows = await fetchAllRows("audit_log", { order: { column: "created_at", ascending: false } });
      setAllAuditLogs(rows);
    } catch (e: any) {
      toast.error("Erro ao carregar logs: " + e.message);
    }
    setAuditLoading(false);
  };

  useEffect(() => {
    if (activeTab === "auditoria") loadAuditLogs();
  }, [activeTab]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return allAuditLogs.filter(log => {
      if (auditFilterUser && auditFilterUser !== "__all__" && log.user_nome !== auditFilterUser) return false;
      if (auditFilterAcao && auditFilterAcao !== "__all__" && log.acao !== auditFilterAcao) return false;
      if (auditFilterTabela && auditFilterTabela !== "__all__" && log.tabela !== auditFilterTabela) return false;
      if (auditFilterDe) {
        const logDate = log.created_at.slice(0, 10);
        if (logDate < auditFilterDe) return false;
      }
      if (auditFilterAte) {
        const logDate = log.created_at.slice(0, 10);
        if (logDate > auditFilterAte) return false;
      }
      return true;
    });
  }, [allAuditLogs, auditFilterUser, auditFilterAcao, auditFilterTabela, auditFilterDe, auditFilterAte]);

  const auditPageCount = Math.max(1, Math.ceil(filteredAuditLogs.length / AUDIT_PAGE_SIZE));
  const auditPageLogs = filteredAuditLogs.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE);

  // Unique values for filters
  const auditUsers = useMemo(() => [...new Set(allAuditLogs.map(l => l.user_nome).filter(Boolean))].sort(), [allAuditLogs]);
  const auditAcoes = useMemo(() => [...new Set(allAuditLogs.map(l => l.acao).filter(Boolean))].sort(), [allAuditLogs]);
  const auditTabelas = useMemo(() => [...new Set(allAuditLogs.map(l => l.tabela).filter(Boolean))].sort(), [allAuditLogs]);

  const exportAuditoria = () => {
    if (filteredAuditLogs.length === 0) { toast.error("Nenhum registro para exportar"); return; }

    const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // XLSX
    const border = { style: "thin" as const, color: { rgb: "000000" } };
    const hdr = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 }, fill: { fgColor: { rgb: "1565C0" } }, border: { top: border, bottom: border, left: border, right: border } };
    const cell = { border: { top: border, bottom: border, left: border, right: border }, font: { sz: 9 } };
    const wb = XLSX.utils.book_new();
    const rows: any[][] = [
      ["REGISTRO DE AUDITORIA DO SISTEMA"],
      [`Gerado em: ${new Date().toLocaleString("pt-BR")} — Total: ${filteredAuditLogs.length} registros`],
      [],
      ["Data/Hora", "Usuário", "Ação", "Tabela", "Registro ID", "Detalhes", "Justificativa"],
    ];
    filteredAuditLogs.forEach(log => {
      rows.push([
        fmtDate(log.created_at),
        log.user_nome || "—",
        log.acao,
        log.tabela,
        log.registro_id || "—",
        log.detalhes || "—",
        log.justificativa || "—",
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    for (let c = 0; c < 7; c++) {
      const addr = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[addr]) ws[addr].s = hdr;
    }
    for (let r = 4; r < rows.length; r++) {
      for (let c = 0; c < 7; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr]) ws[addr].s = cell;
      }
    }
    autoFitColumns(ws, { min: 10, max: 50 });
    XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), sysCfvFileName("Auditoria", "xlsx"));

    // PDF
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("REGISTRO DE AUDITORIA DO SISTEMA", 14, 15);
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")} — Total: ${filteredAuditLogs.length} registros`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [["Data/Hora", "Usuário", "Ação", "Tabela", "Registro ID", "Detalhes", "Justificativa"]],
      body: filteredAuditLogs.map(log => [
        fmtDate(log.created_at),
        log.user_nome || "—",
        log.acao,
        log.tabela,
        log.registro_id || "—",
        log.detalhes || "—",
        log.justificativa || "—",
      ]),
      styles: { fontSize: 6, cellPadding: 1.2 },
      headStyles: { fillColor: [21, 101, 192], fontSize: 6 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 5: { cellWidth: 55 }, 6: { cellWidth: 35 } },
    });
    doc.save(sysCfvFileName("Auditoria", "pdf"));

    toast.success("Auditoria exportada em XLSX + PDF!");
  };

  const saveConfigs = async () => {
    setSaving(true);
    for (const [chave, valor] of Object.entries(configs)) {
      const { data: existing } = await supabase.from("configuracoes_gerais").select("id").eq("chave", chave).maybeSingle();
      if (existing) {
        await supabase.from("configuracoes_gerais").update({ valor } as any).eq("id", existing.id);
      } else {
        await supabase.from("configuracoes_gerais").insert({ chave, valor } as any);
      }
    }
    setSaving(false);
    toast.success("Configurações salvas!");
  };

  const updateBairroMeta = async (id: string, field: string, value: number) => {
    const { error } = await supabase.from("bairros").update({ [field]: value } as any).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setBairros(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    toast.success("Meta atualizada");
  };

  const togglePontoAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("pontos_transporte").update({ ativo } as any).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setPontosTransporte(prev => prev.map(p => p.id === id ? { ...p, ativo } : p));
    toast.success(ativo ? "Ponto ativado" : "Ponto desativado");
  };

  const addPontoTransporte = async () => {
    if (!newPontoNome.trim()) { toast.error("Nome é obrigatório"); return; }
    const { error } = await supabase.from("pontos_transporte").insert({
      nome: newPontoNome.trim(),
      bairro_id: newPontoBairro || null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    setNewPontoNome("");
    setNewPontoBairro("");
    toast.success("Ponto de transporte adicionado");
    loadAll();
  };

  const deletePonto = async (id: string) => {
    const { error } = await supabase.from("pontos_transporte").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setPontosTransporte(prev => prev.filter(p => p.id !== id));
    toast.success("Ponto removido");
  };

  // Profiles with roles merged
  const profilesWithRoles = useMemo(() => {
    return profiles.map(p => {
      const roles = userRoles.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role);
      return { ...p, roles };
    });
  }, [profiles, userRoles]);

  const handleBackup = () => {
    if (backupCategories.length === 0) { toast.error("Selecione ao menos uma categoria"); return; }
    doBackup(backupCategories, backupDateFrom || undefined, backupDateTo || undefined);
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configurações Gerais</h1>
        <p className="text-sm text-muted-foreground">Configurações institucionais e parâmetros do sistema</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="instituicao"><Building2 className="h-4 w-4 mr-1" />Instituição</TabsTrigger>
          <TabsTrigger value="bairros"><MapPin className="h-4 w-4 mr-1" />Bairros</TabsTrigger>
          <TabsTrigger value="transporte"><Bus className="h-4 w-4 mr-1" />Transporte</TabsTrigger>
          <TabsTrigger value="equipe"><Users className="h-4 w-4 mr-1" />Equipe</TabsTrigger>
          <TabsTrigger value="auditoria"><History className="h-4 w-4 mr-1" />Auditoria</TabsTrigger>
          <TabsTrigger value="sistema"><Shield className="h-4 w-4 mr-1" />Sistema</TabsTrigger>
        </TabsList>

        {/* INSTITUIÇÃO */}
        <TabsContent value="instituicao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Institucionais</CardTitle>
              <CardDescription>Informações da entidade usadas em documentos e relatórios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {CONFIG_KEYS.map(k => (
                  <div key={k.key}>
                    <Label className="text-xs">{k.label}</Label>
                    <Input
                      value={configs[k.key] || ""}
                      onChange={e => setConfigs(prev => ({ ...prev, [k.key]: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Marco Operacional
                </Label>
                <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                  Data a partir da qual os indicadores institucionais (dashboard, ELO, adesão, presença, top educadores) começam a contar.
                  Registros anteriores são mantidos no histórico, mas não compõem as métricas analíticas.
                </p>
                <Input
                  type="date"
                  value={configs["data_inicio_operacional"] || "2026-04-01"}
                  onChange={e => setConfigs(prev => ({ ...prev, data_inicio_operacional: e.target.value }))}
                  className="mt-1 max-w-xs"
                />
              </div>

              <Button onClick={saveConfigs} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BAIRROS E METAS */}
        <TabsContent value="bairros">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bairros e Metas SCFV</CardTitle>
              <CardDescription>Defina as metas de atendimento por bairro para acompanhamento no dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Bairro</TableHead>
                      <TableHead className="text-xs text-center">Meta Crianças (Manhã)</TableHead>
                      <TableHead className="text-xs text-center">Meta Crianças (Tarde)</TableHead>
                      <TableHead className="text-xs text-center">Meta Idosos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bairros.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm font-medium">{b.nome}</TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 w-20 mx-auto text-center text-sm" defaultValue={b.meta_criancas_manha || 0}
                            onBlur={e => updateBairroMeta(b.id, "meta_criancas_manha", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 w-20 mx-auto text-center text-sm" defaultValue={b.meta_criancas_tarde || 0}
                            onBlur={e => updateBairroMeta(b.id, "meta_criancas_tarde", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 w-20 mx-auto text-center text-sm" defaultValue={b.meta_idosos || 0}
                            onBlur={e => updateBairroMeta(b.id, "meta_idosos", Number(e.target.value))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TRANSPORTE */}
        <TabsContent value="transporte">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bus className="h-5 w-5" />Pontos de Transporte</CardTitle>
              <CardDescription>Gerencie os pontos de embarque e desembarque dos participantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Nome do Ponto</Label>
                  <Input value={newPontoNome} onChange={e => setNewPontoNome(e.target.value)} placeholder="Ex: Praça Central" className="mt-1" />
                </div>
                <div className="w-[200px]">
                  <Label className="text-xs">Bairro</Label>
                  <Select value={newPontoBairro} onValueChange={setNewPontoBairro}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {bairros.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addPontoTransporte} size="sm" className="gap-1"><Plus className="h-4 w-4" />Adicionar</Button>
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Bairro</TableHead>
                      <TableHead className="text-xs text-center">Horário Manhã</TableHead>
                      <TableHead className="text-xs text-center">Horário Tarde</TableHead>
                      <TableHead className="text-xs text-center">Ativo</TableHead>
                      <TableHead className="text-xs text-center w-[60px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pontosTransporte.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">Nenhum ponto cadastrado</TableCell></TableRow>
                    ) : pontosTransporte.map(p => (
                      <TableRow key={p.id} className={!p.ativo ? "opacity-50" : ""}>
                        <TableCell className="text-sm font-medium">{p.nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.bairros?.nome || "—"}</TableCell>
                        <TableCell className="text-sm text-center">{p.horario_manha || "—"}</TableCell>
                        <TableCell className="text-sm text-center">{p.horario_tarde || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={p.ativo !== false} onCheckedChange={v => togglePontoAtivo(p.id, v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deletePonto(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EQUIPE */}
        <TabsContent value="equipe">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><UserCog className="h-5 w-5" />Equipe e Gestão de RH</CardTitle>
              <CardDescription>Gerencie status, carga horária, salário e datas dos profissionais</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Cargo</TableHead>
                      <TableHead className="text-xs">Funções</TableHead>
                      <TableHead className="text-xs text-center">Ativo</TableHead>
                      <TableHead className="text-xs">Carga Horária</TableHead>
                      <TableHead className="text-xs">Salário</TableHead>
                      <TableHead className="text-xs">Data Início</TableHead>
                      <TableHead className="text-xs">Data Desligamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profilesWithRoles.map(p => (
                      <TableRow key={p.id} className={!p.ativo ? "opacity-60" : ""}>
                        <TableCell className="text-sm font-medium">
                          {p.nome}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.roles.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground">Sem função</span>
                            ) : p.roles.map((r: string) => (
                              <Badge key={r} variant="outline" className={`text-[10px] ${ROLE_COLORS[r] || ""}`}>
                                {ROLE_LABELS[r] || r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.cargo || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.email || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={p.ativo !== false}
                            onCheckedChange={async (v) => {
                              const { error } = await supabase.from("profiles").update({ ativo: v } as any).eq("id", p.id);
                              if (error) { toast.error("Erro: " + error.message); return; }
                              setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, ativo: v } : x));
                              toast.success(v ? "Profissional ativado" : "Profissional desativado");
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 w-24 text-xs"
                            defaultValue={p.carga_horaria || ""}
                            placeholder="Ex: 40h"
                            onBlur={async (e) => {
                              const val = e.target.value.trim() || null;
                              if (val === (p.carga_horaria || null)) return;
                              const { error } = await supabase.from("profiles").update({ carga_horaria: val } as any).eq("id", p.id);
                              if (error) { toast.error("Erro: " + error.message); return; }
                              setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, carga_horaria: val } : x));
                              toast.success("Carga horária atualizada");
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 w-28 text-xs"
                            type="number"
                            step="0.01"
                            defaultValue={p.salario ?? ""}
                            placeholder="R$ 0,00"
                            onBlur={async (e) => {
                              const val = e.target.value.trim() ? Number(e.target.value) : null;
                              const { error } = await supabase.from("profiles").update({ salario: val } as any).eq("id", p.id);
                              if (error) { toast.error("Erro: " + error.message); return; }
                              setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, salario: val } : x));
                              toast.success("Salário atualizado");
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 w-36 text-xs"
                            type="date"
                            defaultValue={p.data_inicio || ""}
                            onBlur={async (e) => {
                              const val = e.target.value || null;
                              if (val === (p.data_inicio || null)) return;
                              const { error } = await supabase.from("profiles").update({ data_inicio: val } as any).eq("id", p.id);
                              if (error) { toast.error("Erro: " + error.message); return; }
                              setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, data_inicio: val } : x));
                              toast.success("Data de início atualizada");
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-7 w-36 text-xs"
                            type="date"
                            defaultValue={p.data_desligamento || ""}
                            onBlur={async (e) => {
                              const val = e.target.value || null;
                              if (val === (p.data_desligamento || null)) return;
                              const { error } = await supabase.from("profiles").update({ data_desligamento: val } as any).eq("id", p.id);
                              if (error) { toast.error("Erro: " + error.message); return; }
                              setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, data_desligamento: val } : x));
                              toast.success("Data de desligamento atualizada");
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Para cadastrar novos profissionais ou alterar funções, use a página de <strong>Banco de Dados</strong> → Profissionais.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="auditoria">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-5 w-5" />Log de Auditoria Completo</CardTitle>
              <CardDescription>Todos os registros de auditoria do sistema com filtros e exportação para fins de prestação de contas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={auditFilterDe} onChange={e => { setAuditFilterDe(e.target.value); setAuditPage(0); }} className="h-8 text-xs mt-1 w-36" />
                </div>
                <div>
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={auditFilterAte} onChange={e => { setAuditFilterAte(e.target.value); setAuditPage(0); }} className="h-8 text-xs mt-1 w-36" />
                </div>
                <div>
                  <Label className="text-xs">Usuário</Label>
                  <Select value={auditFilterUser} onValueChange={v => { setAuditFilterUser(v); setAuditPage(0); }}>
                    <SelectTrigger className="h-8 text-xs mt-1 w-40"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {auditUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Ação</Label>
                  <Select value={auditFilterAcao} onValueChange={v => { setAuditFilterAcao(v); setAuditPage(0); }}>
                    <SelectTrigger className="h-8 text-xs mt-1 w-44"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {auditAcoes.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tabela</Label>
                  <Select value={auditFilterTabela} onValueChange={v => { setAuditFilterTabela(v); setAuditPage(0); }}>
                    <SelectTrigger className="h-8 text-xs mt-1 w-40"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {auditTabelas.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1" onClick={exportAuditoria} disabled={filteredAuditLogs.length === 0}>
                  <Download className="h-3.5 w-3.5" />Exportar Auditoria
                </Button>
              </div>

              <Badge variant="secondary" className="text-xs">{filteredAuditLogs.length} registro(s) encontrado(s)</Badge>

              {auditLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data/Hora</TableHead>
                          <TableHead className="text-xs">Usuário</TableHead>
                          <TableHead className="text-xs">Ação</TableHead>
                          <TableHead className="text-xs">Tabela</TableHead>
                          <TableHead className="text-xs">Registro ID</TableHead>
                          <TableHead className="text-xs">Detalhes</TableHead>
                          <TableHead className="text-xs">Justificativa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditPageLogs.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro de auditoria</TableCell></TableRow>
                        ) : auditPageLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell className="text-xs">{log.user_nome || "—"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{log.acao}</Badge></TableCell>
                            <TableCell className="text-xs">{log.tabela}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{log.registro_id || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.detalhes || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{log.justificativa || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {auditPageCount > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={auditPage === 0} onClick={() => setAuditPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">Página {auditPage + 1} de {auditPageCount}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={auditPage >= auditPageCount - 1} onClick={() => setAuditPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SISTEMA */}
        <TabsContent value="sistema">
          <div className="grid gap-4">
            {/* Templates DOCX */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><FileCode2 className="h-5 w-5" />Templates DOCX</CardTitle>
                <CardDescription>Gerencie os templates de documentos e seus mapeamentos de tags</CardDescription>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum template encontrado no storage.</p>
                ) : (
                  <div className="space-y-2">
                    {templates.map(tpl => (
                      <div key={tpl} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{tpl}</p>
                            <p className="text-xs text-muted-foreground">Template de {tpl.replace(".docx", "")}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setTagMapperKey(tpl); setTagMapperOpen(true); }}>
                          <ScrollText className="h-4 w-4 mr-1" /> Mapear Tags
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Segurança */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-5 w-5" />Segurança</CardTitle>
                <CardDescription>Configurações de segurança do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Timeout de Sessão</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Sessão encerrada automaticamente após 30 minutos de inatividade.</p>
                    <Badge variant="outline" className="text-xs">30 min</Badge>
                  </div>
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">RLS (Row Level Security)</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Todas as tabelas possuem políticas de segurança ativas por perfil de acesso.</p>
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-500/20">Ativo</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Database className="h-5 w-5" />Backup e Exportação</CardTitle>
                <CardDescription>Exporte os dados do sistema em formato XLSX compactado em ZIP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label className="text-xs mb-2 block">Categorias para exportar</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {BACKUP_CATEGORIES.map(cat => (
                        <label key={cat.key} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={backupCategories.includes(cat.key)}
                            onCheckedChange={checked => {
                              if (checked) setBackupCategories(prev => [...prev, cat.key]);
                              else setBackupCategories(prev => prev.filter(c => c !== cat.key));
                            }}
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Filtro de período (opcional)</Label>
                    <Input type="date" value={backupDateFrom} onChange={e => setBackupDateFrom(e.target.value)} placeholder="De" />
                    <Input type="date" value={backupDateTo} onChange={e => setBackupDateTo(e.target.value)} placeholder="Até" />
                  </div>
                </div>
                <Button onClick={handleBackup} disabled={backupLoading} className="gap-2">
                  {backupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {backupLoading ? "Exportando..." : "Gerar Backup"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Tag Mapper Dialog */}
      <TemplateTagMapper templateKey={tagMapperKey} open={tagMapperOpen} onOpenChange={setTagMapperOpen} />
    </div>
  );
}
