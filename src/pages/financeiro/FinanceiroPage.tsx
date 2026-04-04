import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, DollarSign, Receipt, Undo2, Layers,
  Upload, FileText, ShieldCheck, Download, Loader2, AlertTriangle, CheckCircle2, Info, ListPlus, ClipboardList, FolderOpen, Paperclip
} from "lucide-react";
import OrcamentosTab from "./OrcamentosTab";
import DocumentosPrestacaoTab from "./DocumentosPrestacaoTab";
import { toast } from "sonner";

type Categoria = { id: string; codigo: string; descricao: string; valor_previsto: number; created_at: string };
type Parcela = { id: string; numero_parcela: number; valor: number; data_recebimento: string; created_at: string };
type Despesa = {
  id: string; codigo_lancamento: string | null; descricao: string; valor: number;
  data_lancamento: string; categoria_id: string | null; mes_referencia: string;
  fornecedor?: string | null; cnpj_cpf?: string | null; numero_documento?: string | null;
  tipo_documento?: string | null; comprovante_url?: string | null; nota_url?: string | null;
  boleto_url?: string | null; status_sit?: string | null; lote_id?: string | null;
  created_at: string;
};
type Estorno = { id: string; categoria_id: string | null; valor: number; mes_referencia: string; created_at: string };

interface AuditFinding {
  severity: "erro" | "alerta" | "sugestao";
  message: string;
  field?: string;
  despesa_id?: string;
}

interface LoteLine {
  descricao: string; valor: string; data_lancamento: string; categoria_id: string;
  fornecedor: string; cnpj_cpf: string; numero_documento: string; tipo_documento: string;
}

interface DetectedDoc {
  file: File;
  uploading: boolean;
  extracted: any | null;
  confirmed: boolean;
  storageUrl?: string;
}

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TIPOS_DOCUMENTO = [
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "cupom_fiscal", label: "Cupom Fiscal" },
  { value: "boleto", label: "Boleto" },
  { value: "darf", label: "DARF" },
  { value: "gps", label: "GPS" },
  { value: "outro", label: "Outro" },
];

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const emptyLoteLine = (): LoteLine => ({
  descricao: "", valor: "", data_lancamento: "", categoria_id: "",
  fornecedor: "", cnpj_cpf: "", numero_documento: "", tipo_documento: "nota_fiscal",
});

export default function FinanceiroPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [estornos, setEstornos] = useState<Estorno[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesRef, setMesRef] = useState(mesAtual());

  // Form states
  const [catForm, setCatForm] = useState({ codigo: "", descricao: "", valor_previsto: "" });
  const [parForm, setParForm] = useState({ numero_parcela: "", valor: "", data_recebimento: "" });
  const [despForm, setDespForm] = useState({
    codigo_lancamento: "", descricao: "", valor: "", data_lancamento: "",
    categoria_id: "", fornecedor: "", cnpj_cpf: "", numero_documento: "", tipo_documento: "nota_fiscal",
  });
  const [estForm, setEstForm] = useState({ categoria_id: "", valor: "" });
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);

  // Batch entry
  const [loteLines, setLoteLines] = useState<LoteLine[]>([emptyLoteLine()]);
  const [loteLoading, setLoteLoading] = useState(false);

  // Document import
  const [docFiles, setDocFiles] = useState<DetectedDoc[]>([]);
  const [docProcessing, setDocProcessing] = useState(false);

  // Audit
  const [auditFindings, setAuditFindings] = useState<AuditFinding[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSummary, setAuditSummary] = useState<{ erros: number; alertas: number; sugestoes: number } | null>(null);

  // RCA
  const [rcaLoading, setRcaLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p, d, e] = await Promise.all([
      supabase.from("categorias_financeiras").select("*").order("codigo"),
      supabase.from("parcelas_financeiras").select("*").order("numero_parcela"),
      supabase.from("despesas").select("*").eq("mes_referencia", mesRef).order("data_lancamento"),
      supabase.from("estornos").select("*").eq("mes_referencia", mesRef).order("created_at"),
    ]);
    setCategorias((c.data as Categoria[]) || []);
    setParcelas((p.data as Parcela[]) || []);
    setDespesas((d.data as Despesa[]) || []);
    setEstornos((e.data as Estorno[]) || []);
    setLoading(false);
  }, [mesRef]);

  useEffect(() => { load(); }, [load]);

  const catMap = new Map(categorias.map(c => [c.id, c]));

  const totalRecebido = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const totalEstornos = estornos.reduce((s, e) => s + Number(e.valor), 0);
  const saldo = totalRecebido - totalDespesas + totalEstornos;
  const gastosPrevistos = despesas.filter(d => (d as any).orcamento_id && !d.comprovante_url && !d.nota_url && !d.boleto_url).reduce((s, d) => s + Number(d.valor), 0);

  const addCategoria = async () => {
    if (!catForm.codigo || !catForm.descricao) return;
    const { error } = await supabase.from("categorias_financeiras").insert({
      codigo: catForm.codigo, descricao: catForm.descricao, valor_previsto: Number(catForm.valor_previsto) || 0,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setCatForm({ codigo: "", descricao: "", valor_previsto: "" });
    setDialogOpen(null);
    toast.success("Categoria adicionada");
    load();
  };

  const addParcela = async () => {
    if (!parForm.numero_parcela || !parForm.valor || !parForm.data_recebimento) return;
    const { error } = await supabase.from("parcelas_financeiras").insert({
      numero_parcela: Number(parForm.numero_parcela), valor: Number(parForm.valor), data_recebimento: parForm.data_recebimento,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setParForm({ numero_parcela: "", valor: "", data_recebimento: "" });
    setDialogOpen(null);
    toast.success("Parcela adicionada");
    load();
  };

  const addDespesa = async () => {
    if (!despForm.descricao || !despForm.valor || !despForm.data_lancamento) return;
    const { error } = await supabase.from("despesas").insert({
      codigo_lancamento: despForm.codigo_lancamento || null,
      descricao: despForm.descricao,
      valor: Number(despForm.valor),
      data_lancamento: despForm.data_lancamento,
      categoria_id: despForm.categoria_id || null,
      mes_referencia: mesRef,
      fornecedor: despForm.fornecedor || null,
      cnpj_cpf: despForm.cnpj_cpf || null,
      numero_documento: despForm.numero_documento || null,
      tipo_documento: despForm.tipo_documento || "nota_fiscal",
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setDespForm({
      codigo_lancamento: "", descricao: "", valor: "", data_lancamento: "",
      categoria_id: "", fornecedor: "", cnpj_cpf: "", numero_documento: "", tipo_documento: "nota_fiscal",
    });
    setDialogOpen(null);
    toast.success("Despesa adicionada");
    load();
  };

  const addEstorno = async () => {
    if (!estForm.valor) return;
    const { error } = await supabase.from("estornos").insert({
      categoria_id: estForm.categoria_id || null,
      valor: Number(estForm.valor),
      mes_referencia: mesRef,
    });
    if (error) { toast.error("Erro ao salvar"); return; }
    setEstForm({ categoria_id: "", valor: "" });
    setDialogOpen(null);
    toast.success("Estorno adicionado");
    load();
  };

  const deleteRow = async (table: string, id: string) => {
    await (supabase.from as any)(table).delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Build month options
  const now = new Date();
  const monthOptions: { value: string; label: string }[] = [];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
    for (let m = 0; m < 12; m++) {
      const val = `${y}-${String(m + 1).padStart(2, "0")}`;
      monthOptions.push({ value: val, label: `${MESES_NOMES[m]} ${y}` });
    }
  }

  // === BATCH ENTRY ===
  const updateLoteLine = (idx: number, field: keyof LoteLine, value: string) => {
    setLoteLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const saveLote = async () => {
    const valid = loteLines.filter(l => l.descricao && l.valor && l.data_lancamento);
    if (valid.length === 0) { toast.error("Preencha pelo menos uma linha"); return; }
    setLoteLoading(true);
    const lote_id = crypto.randomUUID();
    const rows = valid.map(l => ({
      descricao: l.descricao,
      valor: Number(l.valor),
      data_lancamento: l.data_lancamento,
      categoria_id: l.categoria_id || null,
      mes_referencia: mesRef,
      fornecedor: l.fornecedor || null,
      cnpj_cpf: l.cnpj_cpf || null,
      numero_documento: l.numero_documento || null,
      tipo_documento: l.tipo_documento || "nota_fiscal",
      lote_id,
    }));
    const { error } = await supabase.from("despesas").insert(rows);
    setLoteLoading(false);
    if (error) { toast.error("Erro ao salvar lote"); return; }
    toast.success(`${valid.length} despesas lançadas em lote`);
    setLoteLines([emptyLoteLine()]);
    setDialogOpen(null);
    load();
  };

  // === DOCUMENT IMPORT ===
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: DetectedDoc[] = Array.from(files).map(f => ({
      file: f, uploading: false, extracted: null, confirmed: false,
    }));
    setDocFiles(prev => [...prev, ...newDocs]);

    // Process each file
    for (let i = 0; i < newDocs.length; i++) {
      const doc = newDocs[i];
      setDocProcessing(true);
      try {
        // Upload to storage first
        const ext = doc.file.name.split(".").pop() || "pdf";
        const path = `financeiro/${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("documentos").upload(path, doc.file);
        if (upErr) throw upErr;
        const { data: urlData } = await supabase.storage.from("documentos").getPublicUrl(path);

        // Convert to base64 for AI
        const buffer = await doc.file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        const { data, error } = await supabase.functions.invoke("detect-despesa-from-doc", {
          body: { file_base64: base64, mime_type: doc.file.type },
        });

        setDocFiles(prev => prev.map((d, idx) =>
          d.file === doc.file
            ? { ...d, extracted: error ? null : data?.extracted, uploading: false, storageUrl: urlData?.publicUrl }
            : d
        ));
      } catch (err) {
        console.error("Doc processing error:", err);
        toast.error(`Erro ao processar ${doc.file.name}`);
      }
    }
    setDocProcessing(false);
    e.target.value = "";
  };

  const updateDocExtracted = (idx: number, field: string, value: any) => {
    setDocFiles(prev => prev.map((d, i) =>
      i === idx ? { ...d, extracted: { ...d.extracted, [field]: value } } : d
    ));
  };

  const saveImportedDocs = async () => {
    const toSave = docFiles.filter(d => d.extracted);
    if (toSave.length === 0) return;
    const lote_id = crypto.randomUUID();
    const rows = toSave.map(d => ({
      descricao: d.extracted.descricao || "Sem descrição",
      valor: Number(d.extracted.valor) || 0,
      data_lancamento: d.extracted.data_lancamento || new Date().toISOString().split("T")[0],
      categoria_id: null,
      mes_referencia: mesRef,
      fornecedor: d.extracted.fornecedor || null,
      cnpj_cpf: d.extracted.cnpj_cpf || null,
      numero_documento: d.extracted.numero_documento || null,
      tipo_documento: d.extracted.tipo_documento || "nota_fiscal",
      nota_url: d.storageUrl || null,
      lote_id,
    }));
    const { error } = await supabase.from("despesas").insert(rows);
    if (error) { toast.error("Erro ao lançar"); return; }
    toast.success(`${toSave.length} despesas importadas`);
    setDocFiles([]);
    setDialogOpen(null);
    load();
  };

  // === RCA ===
  const generateRCA = async () => {
    setRcaLoading(true);
    const [, m] = mesRef.split("-");
    const { data, error } = await supabase.functions.invoke("generate-rca", {
      body: { mes: Number(m), ano: Number(mesRef.split("-")[0]) },
    });
    setRcaLoading(false);
    if (error || data?.error) { toast.error(data?.error || "Erro ao gerar RCA"); return; }
    if (data?.url) window.open(data.url, "_blank");
    toast.success("RCA gerada com sucesso");
  };

  // === AUDIT ===
  const runAudit = async () => {
    setAuditLoading(true);
    setAuditFindings(null);
    const [, m] = mesRef.split("-");
    const { data, error } = await supabase.functions.invoke("audit-financeiro", {
      body: { mes: Number(m), ano: Number(mesRef.split("-")[0]) },
    });
    setAuditLoading(false);
    if (error || data?.error) { toast.error(data?.error || "Erro na auditoria"); return; }
    setAuditFindings(data.findings || []);
    setAuditSummary(data.summary || null);
  };

  // === RPA SCRIPT ===
  const generateRPAScript = () => {
    const script = `#!/usr/bin/env python3
"""
Script de automação RPA para lançamento no SIT
Gerado automaticamente pelo SysELO — ${mesRef}
Requer: pip install playwright && playwright install chromium
"""
import asyncio
from playwright.async_api import async_playwright
import json

# === CREDENCIAIS (preencha antes de executar) ===
SIT_URL = "https://sit.mds.gov.br"  # URL do SIT
USERNAME = "SEU_USUARIO"
PASSWORD = "SUA_SENHA"

# === DADOS DAS DESPESAS ===
despesas = ${JSON.stringify(despesas.map(d => ({
  descricao: d.descricao,
  valor: Number(d.valor),
  data: d.data_lancamento,
  fornecedor: d.fornecedor || "",
  cnpj_cpf: d.cnpj_cpf || "",
  numero_documento: d.numero_documento || "",
  tipo: d.tipo_documento || "nota_fiscal",
  categoria: d.categoria_id ? (catMap.get(d.categoria_id)?.codigo || "") : "",
})), null, 2)}

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # 1. Login
        await page.goto(SIT_URL)
        await page.fill('input[name="usuario"]', USERNAME)
        await page.fill('input[name="senha"]', PASSWORD)
        await page.click('button[type="submit"]')
        await page.wait_for_load_state("networkidle")
        print("Login realizado")
        
        # 2. Navegar até lançamento de despesas
        # IMPORTANTE: Ajuste os seletores conforme a interface do SIT
        # await page.click('text=Prestação de Contas')
        # await page.click('text=Lançar Despesa')
        
        for i, d in enumerate(despesas):
            print(f"Lançando despesa {i+1}/{len(despesas)}: {d['descricao']}")
            # AJUSTE os seletores abaixo conforme a tela do SIT:
            # await page.fill('#descricao', d['descricao'])
            # await page.fill('#valor', str(d['valor']))
            # await page.fill('#data', d['data'])
            # await page.fill('#fornecedor', d['fornecedor'])
            # await page.fill('#cnpj_cpf', d['cnpj_cpf'])
            # await page.fill('#numero_documento', d['numero_documento'])
            # await page.click('button[type="submit"]')
            # await page.wait_for_load_state("networkidle")
            pass
        
        print(f"\\n{len(despesas)} despesas processadas!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
`;
    const blob = new Blob([script], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rpa_sit_${mesRef}.py`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Script RPA baixado");
  };

  const severityIcon = (s: string) => {
    if (s === "erro") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (s === "alerta") return <Info className="h-4 w-4 text-amber-500" />;
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">Financeiro</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={mesRef} onValueChange={setMesRef}>
            <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={generateRCA} disabled={rcaLoading} className="gap-1">
            {rcaLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Gerar RCA
          </Button>
          <Button variant="outline" size="sm" onClick={generateRPAScript} className="gap-1">
            <FileText className="h-3 w-3" />Script RPA
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Total Recebido</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalRecebido)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Despesas ({mesRef})</p>
          <p className="text-lg font-bold text-destructive">{fmt(totalDespesas)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Gastos Previstos</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{fmt(gastosPrevistos)}</p>
          <p className="text-[9px] text-muted-foreground">Orçamentos sem comprovante</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Estornos ({mesRef})</p>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmt(totalEstornos)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-lg font-bold ${saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>{fmt(saldo)}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="despesas">
        <TabsList className="grid grid-cols-8 w-full">
          <TabsTrigger value="despesas" className="text-xs gap-1"><Receipt className="h-3 w-3 hidden sm:block" />Despesas</TabsTrigger>
          <TabsTrigger value="parcelas" className="text-xs gap-1"><DollarSign className="h-3 w-3 hidden sm:block" />Parcelas</TabsTrigger>
          <TabsTrigger value="categorias" className="text-xs gap-1"><Layers className="h-3 w-3 hidden sm:block" />Categorias</TabsTrigger>
          <TabsTrigger value="estornos" className="text-xs gap-1"><Undo2 className="h-3 w-3 hidden sm:block" />Estornos</TabsTrigger>
          <TabsTrigger value="orcamentos" className="text-xs gap-1"><ClipboardList className="h-3 w-3 hidden sm:block" />Orçamentos</TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs gap-1"><FolderOpen className="h-3 w-3 hidden sm:block" />Documentos</TabsTrigger>
          <TabsTrigger value="importar" className="text-xs gap-1"><Upload className="h-3 w-3 hidden sm:block" />Importar</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs gap-1"><ShieldCheck className="h-3 w-3 hidden sm:block" />Auditoria</TabsTrigger>
        </TabsList>

        {/* =================== DESPESAS =================== */}
        <TabsContent value="despesas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm">Despesas — {mesRef}</CardTitle>
              <div className="flex gap-1">
                <Dialog open={dialogOpen === "lote"} onOpenChange={v => setDialogOpen(v ? "lote" : null)}>
                  <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1"><ListPlus className="h-3 w-3" />Lote</Button></DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <DialogHeader><DialogTitle>Lançar Despesas em Lote</DialogTitle></DialogHeader>
                    <div className="space-y-2">
                      {loteLines.map((line, idx) => (
                        <div key={idx} className="grid grid-cols-8 gap-1 items-end">
                          <div className="col-span-2"><Label className="text-[10px]">Descrição *</Label>
                            <Input className="h-7 text-xs" value={line.descricao} onChange={e => updateLoteLine(idx, "descricao", e.target.value)} /></div>
                          <div><Label className="text-[10px]">Valor *</Label>
                            <Input className="h-7 text-xs" type="number" step="0.01" value={line.valor} onChange={e => updateLoteLine(idx, "valor", e.target.value)} /></div>
                          <div><Label className="text-[10px]">Data *</Label>
                            <Input className="h-7 text-xs" type="date" value={line.data_lancamento} onChange={e => updateLoteLine(idx, "data_lancamento", e.target.value)} /></div>
                          <div><Label className="text-[10px]">Fornecedor</Label>
                            <Input className="h-7 text-xs" value={line.fornecedor} onChange={e => updateLoteLine(idx, "fornecedor", e.target.value)} /></div>
                          <div><Label className="text-[10px]">CNPJ/CPF</Label>
                            <Input className="h-7 text-xs" value={line.cnpj_cpf} onChange={e => updateLoteLine(idx, "cnpj_cpf", e.target.value)} /></div>
                          <div><Label className="text-[10px]">Nº Doc</Label>
                            <Input className="h-7 text-xs" value={line.numero_documento} onChange={e => updateLoteLine(idx, "numero_documento", e.target.value)} /></div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLoteLines(prev => prev.filter((_, i) => i !== idx))} disabled={loteLines.length === 1}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setLoteLines(prev => [...prev, emptyLoteLine()])}>
                          <Plus className="h-3 w-3 mr-1" />Linha
                        </Button>
                        <Button size="sm" onClick={saveLote} disabled={loteLoading} className="ml-auto">
                          {loteLoading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Salvar Todas ({loteLines.filter(l => l.descricao && l.valor).length})
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={dialogOpen === "despesa"} onOpenChange={v => setDialogOpen(v ? "despesa" : null)}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Código</Label><Input value={despForm.codigo_lancamento} onChange={e => setDespForm(f => ({ ...f, codigo_lancamento: e.target.value }))} /></div>
                        <div><Label className="text-xs">Tipo Documento</Label>
                          <Select value={despForm.tipo_documento} onValueChange={v => setDespForm(f => ({ ...f, tipo_documento: v }))}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div><Label className="text-xs">Descrição *</Label><Input value={despForm.descricao} onChange={e => setDespForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={despForm.valor} onChange={e => setDespForm(f => ({ ...f, valor: e.target.value }))} /></div>
                        <div><Label className="text-xs">Data *</Label><Input type="date" value={despForm.data_lancamento} onChange={e => setDespForm(f => ({ ...f, data_lancamento: e.target.value }))} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Fornecedor</Label><Input value={despForm.fornecedor} onChange={e => setDespForm(f => ({ ...f, fornecedor: e.target.value }))} /></div>
                        <div><Label className="text-xs">CNPJ/CPF</Label><Input value={despForm.cnpj_cpf} onChange={e => setDespForm(f => ({ ...f, cnpj_cpf: e.target.value }))} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-xs">Nº Documento</Label><Input value={despForm.numero_documento} onChange={e => setDespForm(f => ({ ...f, numero_documento: e.target.value }))} /></div>
                        <div><Label className="text-xs">Categoria</Label>
                          <Select value={despForm.categoria_id} onValueChange={v => setDespForm(f => ({ ...f, categoria_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={addDespesa} className="w-full">Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table><TableHeader><TableRow>
                  <TableHead className="text-xs">Cód.</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Fornecedor</TableHead>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">SIT</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {despesas.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">{d.codigo_lancamento || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{d.descricao}</TableCell>
                      <TableCell className="text-xs">{(d as any).fornecedor || "—"}</TableCell>
                      <TableCell className="text-xs">{d.categoria_id ? (catMap.get(d.categoria_id)?.codigo || "—") : "—"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(Number(d.valor))}</TableCell>
                      <TableCell className="text-xs">{d.data_lancamento}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={(d as any).status_sit === "lancado" ? "default" : "secondary"} className="text-[10px]">
                          {(d as any).status_sit || "pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("despesas", d.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {despesas.length === 0 && <TableRow><TableCell colSpan={8} className="text-xs text-center text-muted-foreground py-6">Nenhuma despesa neste mês</TableCell></TableRow>}
                </TableBody></Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== PARCELAS =================== */}
        <TabsContent value="parcelas">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Parcelas Recebidas</CardTitle>
              <Dialog open={dialogOpen === "parcela"} onOpenChange={v => setDialogOpen(v ? "parcela" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Nova Parcela</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Nº da Parcela *</Label><Input type="number" value={parForm.numero_parcela} onChange={e => setParForm(f => ({ ...f, numero_parcela: e.target.value }))} /></div>
                    <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={parForm.valor} onChange={e => setParForm(f => ({ ...f, valor: e.target.value }))} /></div>
                    <div><Label className="text-xs">Data de Recebimento *</Label><Input type="date" value={parForm.data_recebimento} onChange={e => setParForm(f => ({ ...f, data_recebimento: e.target.value }))} /></div>
                    <Button onClick={addParcela} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Nº</TableHead><TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Data</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {parcelas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.numero_parcela}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(Number(p.valor))}</TableCell>
                    <TableCell className="text-xs">{p.data_recebimento}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("parcelas_financeiras", p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {parcelas.length === 0 && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-6">Nenhuma parcela cadastrada</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== CATEGORIAS =================== */}
        <TabsContent value="categorias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Categorias / Rubricas</CardTitle>
              <Dialog open={dialogOpen === "categoria"} onOpenChange={v => setDialogOpen(v ? "categoria" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Código *</Label><Input value={catForm.codigo} onChange={e => setCatForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ex: 3.3.90.30" /></div>
                    <div><Label className="text-xs">Descrição *</Label><Input value={catForm.descricao} onChange={e => setCatForm(f => ({ ...f, descricao: e.target.value }))} /></div>
                    <div><Label className="text-xs">Valor Previsto</Label><Input type="number" step="0.01" value={catForm.valor_previsto} onChange={e => setCatForm(f => ({ ...f, valor_previsto: e.target.value }))} /></div>
                    <Button onClick={addCategoria} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Código</TableHead><TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs text-right">Previsto</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {categorias.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-mono">{c.codigo}</TableCell>
                    <TableCell className="text-xs">{c.descricao}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(Number(c.valor_previsto))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("categorias_financeiras", c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {categorias.length === 0 && <TableRow><TableCell colSpan={4} className="text-xs text-center text-muted-foreground py-6">Nenhuma categoria cadastrada</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== ESTORNOS =================== */}
        <TabsContent value="estornos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">Estornos — {mesRef}</CardTitle>
              <Dialog open={dialogOpen === "estorno"} onOpenChange={v => setDialogOpen(v ? "estorno" : null)}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Nova</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Novo Estorno</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Categoria</Label>
                      <Select value={estForm.categoria_id} onValueChange={v => setEstForm(f => ({ ...f, categoria_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={estForm.valor} onChange={e => setEstForm(f => ({ ...f, valor: e.target.value }))} /></div>
                    <Button onClick={addEstorno} className="w-full">Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table><TableHeader><TableRow>
                <TableHead className="text-xs">Categoria</TableHead><TableHead className="text-xs text-right">Valor</TableHead><TableHead className="w-8"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {estornos.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{e.categoria_id ? (catMap.get(e.categoria_id)?.descricao || "—") : "—"}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(Number(e.valor))}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRow("estornos", e.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
                {estornos.length === 0 && <TableRow><TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-6">Nenhum estorno neste mês</TableCell></TableRow>}
              </TableBody></Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== IMPORTAR DOCUMENTOS =================== */}
        <TabsContent value="importar">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Importar Documentos Fiscais</CardTitle>
              <p className="text-xs text-muted-foreground">Envie boletos, notas fiscais ou comprovantes e a IA extrairá os dados automaticamente.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  onChange={handleDocUpload}
                  className="text-xs"
                />
                {docProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {docFiles.length > 0 && (
                <div className="space-y-3">
                  {docFiles.map((doc, idx) => (
                    <Card key={idx} className="border-dashed">
                      <CardContent className="pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate max-w-[200px]">{doc.file.name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDocFiles(prev => prev.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                        {doc.extracted ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div><Label className="text-[10px]">Descrição</Label>
                              <Input className="h-7 text-xs" value={doc.extracted.descricao || ""} onChange={e => updateDocExtracted(idx, "descricao", e.target.value)} /></div>
                            <div><Label className="text-[10px]">Valor</Label>
                              <Input className="h-7 text-xs" type="number" value={doc.extracted.valor || ""} onChange={e => updateDocExtracted(idx, "valor", e.target.value)} /></div>
                            <div><Label className="text-[10px]">Data</Label>
                              <Input className="h-7 text-xs" type="date" value={doc.extracted.data_lancamento || ""} onChange={e => updateDocExtracted(idx, "data_lancamento", e.target.value)} /></div>
                            <div><Label className="text-[10px]">Fornecedor</Label>
                              <Input className="h-7 text-xs" value={doc.extracted.fornecedor || ""} onChange={e => updateDocExtracted(idx, "fornecedor", e.target.value)} /></div>
                            <div><Label className="text-[10px]">CNPJ/CPF</Label>
                              <Input className="h-7 text-xs" value={doc.extracted.cnpj_cpf || ""} onChange={e => updateDocExtracted(idx, "cnpj_cpf", e.target.value)} /></div>
                            <div><Label className="text-[10px]">Nº Documento</Label>
                              <Input className="h-7 text-xs" value={doc.extracted.numero_documento || ""} onChange={e => updateDocExtracted(idx, "numero_documento", e.target.value)} /></div>
                            <div><Label className="text-[10px]">Tipo</Label>
                              <Select value={doc.extracted.tipo_documento || "nota_fiscal"} onValueChange={v => updateDocExtracted(idx, "tipo_documento", v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />Processando com IA...
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button onClick={saveImportedDocs} disabled={docFiles.filter(d => d.extracted).length === 0}>
                    Lançar {docFiles.filter(d => d.extracted).length} Despesas
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== AUDITORIA =================== */}
        <TabsContent value="auditoria">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-sm">Auditoria Financeira — {mesRef}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Verifica conformidade MROSC, gaps e inconsistências</p>
              </div>
              <Button size="sm" onClick={runAudit} disabled={auditLoading} className="gap-1">
                {auditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Auditar
              </Button>
            </CardHeader>
            <CardContent>
              {auditSummary && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <Card className="border-destructive/30"><CardContent className="pt-3 text-center">
                    <p className="text-xs text-muted-foreground">Erros</p>
                    <p className="text-2xl font-bold text-destructive">{auditSummary.erros}</p>
                  </CardContent></Card>
                  <Card className="border-amber-500/30"><CardContent className="pt-3 text-center">
                    <p className="text-xs text-muted-foreground">Alertas</p>
                    <p className="text-2xl font-bold text-amber-500">{auditSummary.alertas}</p>
                  </CardContent></Card>
                  <Card className="border-emerald-500/30"><CardContent className="pt-3 text-center">
                    <p className="text-xs text-muted-foreground">Sugestões</p>
                    <p className="text-2xl font-bold text-emerald-500">{auditSummary.sugestoes}</p>
                  </CardContent></Card>
                </div>
              )}

              {auditFindings && auditFindings.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-medium">Nenhuma irregularidade encontrada!</p>
                  <p className="text-xs text-muted-foreground">Todas as despesas estão em conformidade.</p>
                </div>
              )}

              {auditFindings && auditFindings.length > 0 && (
                <div className="space-y-2">
                  {auditFindings.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md border bg-card">
                      {severityIcon(f.severity)}
                      <div className="flex-1">
                        <p className="text-xs">{f.message}</p>
                        {f.field && <Badge variant="outline" className="text-[10px] mt-1">{f.field}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!auditFindings && !auditLoading && (
                <p className="text-xs text-center text-muted-foreground py-6">Clique em "Auditar" para analisar as despesas do mês.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* =================== ORÇAMENTOS =================== */}
        <TabsContent value="orcamentos">
          <OrcamentosTab mesRef={mesRef} categorias={categorias} />
        </TabsContent>
        {/* =================== DOCUMENTOS INSTITUCIONAIS =================== */}
        <TabsContent value="documentos">
          <DocumentosPrestacaoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
