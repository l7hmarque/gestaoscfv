import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, DollarSign, Receipt, Undo2, Layers,
  Upload, FileText, ShieldCheck, Download, Loader2, AlertTriangle, CheckCircle2, Info, ListPlus, ClipboardList, FolderOpen, Paperclip, FileSpreadsheet, Banknote, Link2, FileStack
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import OrcamentosTab from "./OrcamentosTab";
import DocumentosPrestacaoTab from "./DocumentosPrestacaoTab";
import ExportacaoSitCard from "@/components/financeiro/ExportacaoSitCard";
import RegularizarSitDialog from "@/components/financeiro/RegularizarSitDialog";
import ImportReviewDialog from "@/components/financeiro/ImportReviewDialog";
import LotesImportadosTab from "@/components/financeiro/LotesImportadosTab";
import { toast } from "sonner";
import { format } from "date-fns";
import { sysCfvFileName } from "@/lib/fileNaming";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { autoFitColumns } from "@/lib/xlsxAutoFit";
import { validateDespesa, missingFieldLabel, type DespesaWarning } from "@/lib/despesaImportValidation";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";

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
  extracted: any | null;            // legado (1ª despesa) - mantido p/ compat
  extractedList: any[];             // NOVO: todas as despesas detectadas no PDF
  confirmed: boolean;
  storageUrl?: string;
}

const MESES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const TIPOS_DOCUMENTO = [
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "cupom_fiscal", label: "Cupom Fiscal" },
  { value: "boleto", label: "Boleto" },
  { value: "folha_pagamento", label: "Folha Pagamento/Holerite" },
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
  const { log: auditLog } = useAuditLog();
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

  // Edit despesa
  const [editDesp, setEditDesp] = useState<Despesa | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete with justificativa
  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string; label: string } | null>(null);
  const [deleteJustificativa, setDeleteJustificativa] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Batch entry
  const [loteLines, setLoteLines] = useState<LoteLine[]>([emptyLoteLine()]);
  const [loteLoading, setLoteLoading] = useState(false);

  // Document import
  const [docFiles, setDocFiles] = useState<DetectedDoc[]>([]);
  const [docProcessing, setDocProcessing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);

  // Audit
  const [auditFindings, setAuditFindings] = useState<AuditFinding[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSummary, setAuditSummary] = useState<{ erros: number; alertas: number; sugestoes: number } | null>(null);

  // RCA
  const [rcaLoading, setRcaLoading] = useState(false);
  const [pcLoading, setPcLoading] = useState(false);
  const [reoLoading, setReoLoading] = useState(false);
  const [pdfConsolidadoLoading, setPdfConsolidadoLoading] = useState(false);

  // Controle Bancário
  const [cbFile, setCbFile] = useState<File | null>(null);
  const [cbUploading, setCbUploading] = useState(false);
  const [cbLancamentos, setCbLancamentos] = useState<any[]>([]);
  const [cbSaving, setCbSaving] = useState(false);
  const [cbExisting, setCbExisting] = useState<any[]>([]);

  // Pipeline filter
  const [despFilter, setDespFilter] = useState<"all" | "pendente" | "aguardando" | "completa">("all");
  const [filtroSit, setFiltroSit] = useState(false);
  const [regularizarTarget, setRegularizarTarget] = useState<any | null>(null);

  // Roles para liberar "lançar pendentes" só para coordenação
  const { user } = useAuth();
  const [isCoordenacao, setIsCoordenacao] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      setIsCoordenacao((data || []).some((r: any) => r.role === "coordenacao"));
    })();
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p, d, e, cb] = await Promise.all([
      supabase.from("categorias_financeiras").select("*").order("codigo"),
      supabase.from("parcelas_financeiras").select("*").order("numero_parcela"),
      supabase.from("despesas").select("*").eq("mes_referencia", mesRef).order("data_lancamento"),
      supabase.from("estornos").select("*").eq("mes_referencia", mesRef).order("created_at"),
      supabase.from("controle_bancario_lancamentos").select("*").eq("mes_referencia", mesRef).order("ordem"),
    ]);
    setCategorias((c.data as Categoria[]) || []);
    setParcelas((p.data as Parcela[]) || []);
    setDespesas((d.data as Despesa[]) || []);
    setEstornos((e.data as Estorno[]) || []);
    setCbExisting((cb.data as any[]) || []);
    setLoading(false);
  }, [mesRef]);

  useEffect(() => { load(); }, [load]);

  const catMap = new Map(categorias.map(c => [c.id, c]));

  const totalRecebido = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const totalEstornos = estornos.reduce((s, e) => s + Number(e.valor), 0);
  const saldo = totalRecebido - totalDespesas + totalEstornos;
  const gastosPrevistos = despesas.filter(d => (d as any).orcamento_id && !d.comprovante_url && !d.nota_url && !d.boleto_url).reduce((s, d) => s + Number(d.valor), 0);

  // Pipeline status helpers
  const despStatus = (d: Despesa) => {
    const hasNF = !!d.nota_url;
    const hasBoleto = !!d.boleto_url;
    const hasComprovante = !!d.comprovante_url;
    if (hasComprovante) return "completa";
    if (hasNF || hasBoleto) return "aguardando";
    return "pendente";
  };
  const despCompletas = despesas.filter(d => despStatus(d) === "completa").length;
  const despAguardando = despesas.filter(d => despStatus(d) === "aguardando").length;
  const despPendentes = despesas.filter(d => despStatus(d) === "pendente").length;
  const filteredDespesas = despFilter === "all" ? despesas : despesas.filter(d => despStatus(d) === despFilter);
  const filteredDespesasFinal = filtroSit
    ? filteredDespesas.filter((d: any) => !d.sit_completo || !d.comprovante_url)
    : filteredDespesas;

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

  const confirmDeleteRow = async () => {
    if (!deleteTarget) return;
    if (!deleteJustificativa.trim()) { toast.error("Informe a justificativa"); return; }
    setDeleteLoading(true);
    await auditLog({
      acao: "exclusão",
      tabela: deleteTarget.table,
      registro_id: deleteTarget.id,
      detalhes: deleteTarget.label,
      justificativa: deleteJustificativa.trim(),
    });
    await (supabase.from as any)(deleteTarget.table).delete().eq("id", deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    setDeleteJustificativa("");
    toast.success("Removido com registro de auditoria");
    load();
  };

  const updateDespesa = async () => {
    if (!editDesp) return;
    const originalDesp = despesas.find(d => d.id === editDesp.id);
    if (!originalDesp) return;
    setEditSaving(true);

    const updatePayload = {
      codigo_lancamento: editDesp.codigo_lancamento || null,
      descricao: editDesp.descricao,
      valor: Number(editDesp.valor),
      data_lancamento: editDesp.data_lancamento,
      categoria_id: editDesp.categoria_id || null,
      fornecedor: editDesp.fornecedor || null,
      cnpj_cpf: editDesp.cnpj_cpf || null,
      numero_documento: editDesp.numero_documento || null,
      tipo_documento: editDesp.tipo_documento || "nota_fiscal",
      status_sit: editDesp.comprovante_url ? "pago" : "aguardando_pagamento",
    };

    const { error } = await supabase.from("despesas").update(updatePayload).eq("id", editDesp.id);
    if (error) { setEditSaving(false); toast.error("Erro ao atualizar"); return; }

    // --- Registrar histórico de alterações ---
    const fieldsToTrack: { key: keyof Despesa; label: string }[] = [
      { key: "descricao", label: "Descrição" },
      { key: "valor", label: "Valor" },
      { key: "data_lancamento", label: "Data" },
      { key: "categoria_id", label: "Categoria" },
      { key: "fornecedor", label: "Fornecedor" },
      { key: "cnpj_cpf", label: "CNPJ/CPF" },
      { key: "numero_documento", label: "Nº Documento" },
      { key: "tipo_documento", label: "Tipo Documento" },
      { key: "status_sit", label: "Status SIT" },
      { key: "codigo_lancamento", label: "Código" },
    ];
    const changes: { despesa_id: string; campo: string; valor_anterior: string | null; valor_novo: string | null }[] = [];
    for (const f of fieldsToTrack) {
      const oldVal = String(originalDesp[f.key] ?? "");
      const newVal = String((editDesp as any)[f.key] ?? "");
      if (oldVal !== newVal) {
        changes.push({
          despesa_id: editDesp.id,
          campo: f.label,
          valor_anterior: originalDesp[f.key] != null ? oldVal : null,
          valor_novo: (editDesp as any)[f.key] != null ? newVal : null,
        });
      }
    }
    if (changes.length > 0) {
      await supabase.from("despesa_historico").insert(changes as any);
    }

    // --- Sync orçamento vinculado ---
    const orcId = (editDesp as any).orcamento_id;
    if (orcId) {
      const orcUpdate: Record<string, any> = {};
      if (Number(editDesp.valor) !== Number(originalDesp.valor)) {
        // nada automático no valor do orçamento, mas mudamos fornecedor se mudou
      }
      if (editDesp.fornecedor !== originalDesp.fornecedor) {
        orcUpdate.fornecedor_vencedor = editDesp.fornecedor || null;
      }
      if (editDesp.cnpj_cpf !== originalDesp.cnpj_cpf) {
        orcUpdate.cnpj_vencedor = editDesp.cnpj_cpf || null;
      }
      if (editDesp.categoria_id !== originalDesp.categoria_id) {
        orcUpdate.categoria_id = editDesp.categoria_id || null;
      }
      if (Object.keys(orcUpdate).length > 0) {
        await supabase.from("orcamentos").update(orcUpdate).eq("id", orcId);
      }
    }

    setEditSaving(false);
    setEditDesp(null);
    load();

    // --- Toast com links de exportação ---
    toast.success("Despesa atualizada", {
      description: changes.length > 0
        ? `${changes.length} campo(s) alterado(s). Documentos de prestação de contas podem estar desatualizados.`
        : undefined,
      duration: 8000,
      action: {
        label: "Gerar RCA",
        onClick: () => generateRCA(),
      },
    });
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
      file: f, uploading: false, extracted: null, extractedList: [], confirmed: false,
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
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let j = 0; j < bytes.length; j += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(j, j + chunkSize));
        }
        const base64 = btoa(binary);

        const { data, error } = await supabase.functions.invoke("detect-despesa-from-doc", {
          body: { file_base64: base64, mime_type: doc.file.type },
        });

        const list: any[] = Array.isArray(data?.despesas) && data.despesas.length > 0
          ? data.despesas
          : (data?.extracted ? [data.extracted] : []);
        if (!error && list.length > 1) toast.success(`${list.length} despesas detectadas em ${doc.file.name}`);

        setDocFiles(prev => prev.map((d) =>
          d.file === doc.file
            ? {
                ...d,
                extracted: error ? null : (list[0] ?? null),
                extractedList: error ? [] : list,
                uploading: false,
                storageUrl: urlData?.publicUrl,
              }
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

  const updateDocExtracted = (docIdx: number, despIdx: number, field: string, value: any) => {
    setDocFiles(prev => prev.map((d, i) => {
      if (i !== docIdx) return d;
      const newList = d.extractedList.map((item, j) => j === despIdx ? { ...item, [field]: value } : item);
      return { ...d, extractedList: newList, extracted: newList[0] ?? d.extracted };
    }));
  };

  const removeDespesa = (docIdx: number, despIdx: number) => {
    setDocFiles(prev => prev.map((d, i) => {
      if (i !== docIdx) return d;
      const newList = d.extractedList.filter((_, j) => j !== despIdx);
      return { ...d, extractedList: newList, extracted: newList[0] ?? null };
    }));
  };

  // Pré-validação de todas as despesas extraídas (memoizada por render)
  const rubricaToCategoriaId = (() => {
    const m: Record<string, string> = {};
    for (const c of categorias) m[c.codigo.trim()] = c.id;
    return m;
  })();
  const validatedDocs = docFiles.map((d, docIdx) => ({
    docIdx,
    fileName: d.file.name,
    storageUrl: d.storageUrl,
    items: d.extractedList.map((e, despIdx) => ({
      despIdx,
      original: e,
      ...validateDespesa(e, { mesRef, storageUrl: d.storageUrl, rubricaToCategoriaId }),
    })),
  }));

  const totalImportDespesas = validatedDocs.reduce((s, d) => s + d.items.length, 0);
  const totalWithMissing = validatedDocs.reduce(
    (s, d) => s + d.items.filter((it) => it.missing.length > 0).length,
    0
  );
  const totalWithWarnings = validatedDocs.reduce(
    (s, d) =>
      s + d.items.filter((it) => it.warnings.length > 0 && it.missing.length === 0).length,
    0
  );

  const openReview = () => {
    if (totalImportDespesas === 0) return;
    setReviewOpen(true);
  };

  const confirmAndSaveImportedDocs = async (opts: { allowPendentes: boolean }) => {
    if (totalImportDespesas === 0) return;
    // Bloqueio: pendências só passam com flag de coordenação
    if (totalWithMissing > 0 && !(opts.allowPendentes && isCoordenacao)) {
      toast.error(
        `${totalWithMissing} despesa(s) com campos obrigatórios ausentes. Edite-as antes de lançar.`
      );
      return;
    }

    setSavingDocs(true);
    const lote_id = crypto.randomUUID();

    // Telemetria por regra (usada também no diagnóstico do lote)
    const ruleCounts: Record<string, number> = {};
    let totalOk = 0;
    let totalAjustes = 0;
    let totalBloqueadas = 0;
    for (const d of validatedDocs) {
      for (const it of d.items) {
        for (const w of it.warnings as DespesaWarning[]) {
          ruleCounts[w.rule] = (ruleCounts[w.rule] || 0) + 1;
        }
        if (it.missing.length > 0) totalBloqueadas++;
        else if (it.warnings.length > 0) totalAjustes++;
        else totalOk++;
      }
    }

    /* eslint-disable no-console */
    console.groupCollapsed(`[ImportDespesas] lote ${lote_id}`);
    console.log("Mês:", mesRef);
    console.log("Arquivos:", validatedDocs.map((d) => ({ file: d.fileName, qtd: d.items.length })));
    console.log("Totais:", { ok: totalOk, ajustes: totalAjustes, bloqueadas: totalBloqueadas });
    console.log("Regras aplicadas:", ruleCounts);
    console.log(
      "Detalhes por despesa:",
      validatedDocs.flatMap((d) =>
        d.items.map((it) => ({
          file: d.fileName,
          idx: it.despIdx + 1,
          missing: it.missing,
          warnings: it.warnings.map((w) => ({
            rule: w.rule,
            field: w.field,
            severity: w.severity,
            source: w.source,
            matchedAlias: w.matchedAlias,
            original: w.original,
            applied: w.applied,
          })),
        }))
      )
    );
    console.groupEnd();
    /* eslint-enable no-console */

    const rows = validatedDocs.flatMap((d) =>
      d.items.map((it) => ({ ...it.row, lote_id }))
    );
    const { error } = await supabase.from("despesas").insert(rows as any);
    if (error) {
      setSavingDocs(false);
      console.error("Erro ao lançar despesa:", error);
      toast.error(`Erro ao lançar: ${error.message}`);
      return;
    }

    // Grava histórico do lote (best-effort — não bloqueia o usuário se falhar)
    try {
      // Nome do responsável
      let nome: string | null = null;
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("nome")
          .eq("user_id", user.id)
          .maybeSingle();
        nome = (prof as any)?.nome ?? null;
      }
      await (supabase as any).from("despesa_lotes_importacao").insert({
        lote_id,
        confirmado_por: user?.id,
        confirmado_por_nome: nome,
        mes_referencia: mesRef,
        total_despesas: rows.length,
        total_ok: totalOk,
        total_ajustes: totalAjustes,
        total_bloqueadas: totalBloqueadas,
        arquivos: validatedDocs.map((d) => ({
          fileName: d.fileName,
          storageUrl: d.storageUrl ?? null,
          qtdDespesas: d.items.length,
        })),
        resumo_warnings: ruleCounts,
      });
    } catch (e) {
      console.error("Falha ao registrar histórico do lote:", e);
    }

    setSavingDocs(false);
    toast.success(`${rows.length} despesa(s) importada(s)`);
    setReviewOpen(false);
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

  // === EXPORTAR SIT (Despesa.txt) ===
  const generateDespesaTxt = () => {
    if (!despesas.length) { toast.error("Nenhuma despesa para exportar"); return; }
    const lines = despesas.map(d => {
      const tipoLabel = TIPOS_DOCUMENTO.find(t => t.value === d.tipo_documento)?.label || d.tipo_documento || "";
      return [
        d.codigo_lancamento || "",
        d.data_lancamento ? format(new Date(d.data_lancamento + "T12:00:00"), "dd/MM/yyyy") : "",
        Number(d.valor).toFixed(2),
        d.cnpj_cpf?.replace(/\D/g, "") || "",
        tipoLabel,
        d.numero_documento || "",
        (d.descricao || "").replace(/\|/g, " "),
      ].join("|");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sysCfvFileName("Despesa", "txt", mesRef);
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${despesas.length} despesas exportadas para SIT`);
  };

  // === GERAR REO ===
  const generateREO = async (formato: "docx" | "xlsx") => {
    setReoLoading(true);
    const [, m] = mesRef.split("-");
    const { data, error } = await supabase.functions.invoke("generate-reo", {
      body: { mes: Number(m), ano: Number(mesRef.split("-")[0]), formato },
    });
    setReoLoading(false);
    if (error || data?.error) { toast.error(data?.error || "Erro ao gerar REO"); return; }
    if (data?.url) window.open(data.url, "_blank");
    toast.success(`REO (${formato.toUpperCase()}) gerado com sucesso`);
  };

  // === PRESTAÇÃO DE CONTAS ===

  const generatePrestacaoContas = async (formato: "pdf" | "xlsx") => {
    setPcLoading(true);
    try {
      const fmtVal = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const mesLabel = MESES_NOMES[parseInt(mesRef.split("-")[1]) - 1] + " " + mesRef.split("-")[0];

      // Load all despesas (not just filtered month)
      const { data: allDesp } = await supabase.from("despesas").select("*").order("data_lancamento");
      const allDespesas = (allDesp || []) as Despesa[];
      const despMes = allDespesas.filter(d => d.mes_referencia === mesRef);
      const sortPrest = (a: any, b: any) => {
        const oa = a.ordem_prestacao, ob = b.ordem_prestacao;
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        return (a.data_lancamento || "").localeCompare(b.data_lancamento || "");
      };

      const totalRec = parcelas.reduce((s, p) => s + Number(p.valor), 0);
      const totalDesp = despMes.reduce((s, d) => s + Number(d.valor), 0);
      const totalEst = estornos.reduce((s, e) => s + Number(e.valor), 0);
      const saldoPC = totalRec - allDespesas.reduce((s, d) => s + Number(d.valor), 0) + totalEst;

      if (formato === "xlsx") {
        const wb = XLSX.utils.book_new();
        const border = { style: "thin" as const, color: { rgb: "000000" } };
        const hdr = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "C62828" } }, border: { top: border, bottom: border, left: border, right: border } };
        const cell = { border: { top: border, bottom: border, left: border, right: border } };

        // Resumo
        const resumoRows = [
          ["PRESTAÇÃO DE CONTAS — " + mesLabel],
          ["Gerado em: " + new Date().toLocaleString("pt-BR")],
          [],
          ["Item", "Valor"],
          ["Total Recebido (Parcelas)", totalRec],
          ["Despesas no Mês", totalDesp],
          ["Estornos no Mês", totalEst],
          ["Saldo Acumulado", saldoPC],
        ];
        const wsR = XLSX.utils.aoa_to_sheet(resumoRows);
        wsR["!cols"] = [{ wch: 35 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsR, "Resumo");

        // Despesas
        const despRows = [["Código", "Descrição", "Fornecedor", "CNPJ/CPF", "Tipo Doc", "Nº Doc", "Valor", "Data", "Status", "Comprovante", "NF", "Boleto"]];
        despMes.sort(sortPrest).forEach(d => {
          despRows.push([
            d.codigo_lancamento || "", d.descricao, d.fornecedor || "", d.cnpj_cpf || "",
            TIPOS_DOCUMENTO.find(t => t.value === d.tipo_documento)?.label || "",
            d.numero_documento || "", Number(d.valor) as any,
            d.data_lancamento ? format(new Date(d.data_lancamento + "T12:00:00"), "dd/MM/yyyy") : "",
            d.comprovante_url ? "Pago ✓" : "Aguardando ⏳",
            d.comprovante_url ? "Sim" : "", d.nota_url ? "Sim" : "", d.boleto_url ? "Sim" : "",
          ]);
        });
        const wsD = XLSX.utils.aoa_to_sheet(despRows);
        wsD["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 6 }, { wch: 6 }];
        XLSX.utils.book_append_sheet(wb, wsD, "Despesas");

        // Categorias
        const catRows = [["Código", "Descrição", "Previsto", "Gasto", "Estornado", "Saldo"]];
        categorias.forEach(c => {
          const gasto = allDespesas.filter(d => d.categoria_id === c.id).reduce((s, d) => s + Number(d.valor), 0);
          const est = estornos.filter(e => e.categoria_id === c.id).reduce((s, e) => s + Number(e.valor), 0);
          const prev = Number(c.valor_previsto || 0);
          catRows.push([c.codigo, c.descricao, prev as any, gasto as any, est as any, (prev - gasto + est) as any]);
        });
        const wsC = XLSX.utils.aoa_to_sheet(catRows);
        wsC["!cols"] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsC, "Categorias");

        // Documentos
        const docRows = [["Despesa", "Data", "Comprovante", "Nota Fiscal", "Boleto"]];
        despMes.sort(sortPrest).forEach(d => {
          docRows.push([d.descricao, d.data_lancamento, d.comprovante_url ? "Anexado" : "", d.nota_url ? "Anexado" : "", d.boleto_url ? "Anexado" : ""]);
        });
        const wsDoc = XLSX.utils.aoa_to_sheet(docRows);
        wsDoc["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, wsDoc, "Documentos");

        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([buf], { type: "application/octet-stream" }), sysCfvFileName("PrestacaoContas", "xlsx", mesRef));
        toast.success("Prestação de Contas (XLSX) gerada!");
      } else {
        // PDF
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFontSize(16);
        doc.text("PRESTAÇÃO DE CONTAS — " + mesLabel, 14, 15);
        doc.setFontSize(8);
        doc.text("Gerado em: " + new Date().toLocaleString("pt-BR"), 14, 21);

        // Resumo
        autoTable(doc, {
          startY: 26,
          head: [["Item", "Valor (R$)"]],
          body: [
            ["Total Recebido (Parcelas)", fmtVal(totalRec)],
            ["Despesas no Mês", fmtVal(totalDesp)],
            ["Estornos no Mês", fmtVal(totalEst)],
            ["Saldo Acumulado", fmtVal(saldoPC)],
          ],
          styles: { fontSize: 8 },
          headStyles: { fillColor: [198, 40, 40] },
        });

        // Despesas
        const lastY = (doc as any).lastAutoTable?.finalY || 60;
        doc.setFontSize(11);
        doc.text("Despesas Detalhadas", 14, lastY + 8);
        autoTable(doc, {
          startY: lastY + 12,
          head: [["Cód.", "Descrição", "Fornecedor", "Valor", "Data", "Status", "Docs"]],
          body: despMes.sort(sortPrest).map(d => [
            d.codigo_lancamento || "—", d.descricao, d.fornecedor || "—",
            fmtVal(Number(d.valor)),
            d.data_lancamento ? format(new Date(d.data_lancamento + "T12:00:00"), "dd/MM/yyyy") : "—",
            d.comprovante_url ? "Pago ✓" : "Aguardando ⏳",
            [d.comprovante_url ? "Comp" : "", d.nota_url ? "NF" : "", d.boleto_url ? "Bol" : ""].filter(Boolean).join(", ") || "—",
          ]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [198, 40, 40], fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });

        doc.save(sysCfvFileName("PrestacaoContas", "pdf", mesRef));
        toast.success("Prestação de Contas (PDF) gerada!");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar prestação de contas: " + (err.message || ""));
    } finally {
      setPcLoading(false);
    }
  };

  // === CONTROLE BANCÁRIO ===
  const handleCbFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCbFile(file);
    setCbUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 8192;
      for (let j = 0; j < bytes.length; j += chunkSize) binary += String.fromCharCode(...bytes.subarray(j, j + chunkSize));
      const base64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke("detect-controle-bancario", {
        body: { file_base64: base64, mime_type: file.type },
      });
      if (error) throw error;
      const list = Array.isArray(data?.lancamentos) ? data.lancamentos : [];
      setCbLancamentos(list);
      toast.success(`${list.length} lançamentos extraídos`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao extrair: " + (err?.message || ""));
    } finally {
      setCbUploading(false);
      e.target.value = "";
    }
  };

  const saveControleBancario = async () => {
    if (cbLancamentos.length === 0) return;
    setCbSaving(true);
    try {
      // Substitui lançamentos do mês
      await supabase.from("controle_bancario_lancamentos").delete().eq("mes_referencia", mesRef);
      const rows = cbLancamentos
        .filter((l) => l.tipo === "debito") // apenas saídas conciliam com despesas
        .map((l, i) => ({
          mes_referencia: mesRef,
          ordem: l.ordem ?? i + 1,
          data: l.data,
          descricao: l.descricao || "",
          valor: Number(l.valor) || 0,
          nr_documento: l.nr_documento || null,
          origem_arquivo: cbFile?.name || null,
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from("controle_bancario_lancamentos").insert(rows as any);
        if (error) throw error;
      }
      // Roda matcher
      const { data: matchRes, error: mErr } = await (supabase as any).rpc("match_controle_bancario_to_despesas", { p_mes: mesRef });
      if (mErr) throw mErr;
      const m = Array.isArray(matchRes) ? matchRes[0] : matchRes;
      toast.success(`Controle Bancário salvo. Conciliados: ${m?.matched ?? 0}/${m?.total ?? rows.length}`);
      setCbLancamentos([]);
      setCbFile(null);
      load();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || ""));
    } finally {
      setCbSaving(false);
    }
  };

  const reconciliar = async () => {
    setCbSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("match_controle_bancario_to_despesas", { p_mes: mesRef });
      if (error) throw error;
      const m = Array.isArray(data) ? data[0] : data;
      toast.success(`Reconciliação: ${m?.matched ?? 0}/${m?.total ?? 0}`);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || ""));
    } finally {
      setCbSaving(false);
    }
  };

  // === PDF CONSOLIDADO DA PRESTAÇÃO ===
  const generatePdfConsolidado = async () => {
    setPdfConsolidadoLoading(true);
    try {
      const sortPrest = (a: any, b: any) => {
        const oa = a.ordem_prestacao, ob = b.ordem_prestacao;
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        return (a.data_lancamento || "").localeCompare(b.data_lancamento || "");
      };
      const ordered = [...despesas].sort(sortPrest);
      if (ordered.length === 0) { toast.error("Nenhuma despesa para consolidar"); return; }

      const merged = await PDFDocument.create();
      const seenUrls = new Set<string>();
      let okCount = 0;
      let errCount = 0;

      for (const d of ordered) {
        const urls = [d.nota_url, d.boleto_url, d.comprovante_url].filter((u): u is string => !!u);
        for (const url of urls) {
          if (seenUrls.has(url)) continue;
          seenUrls.add(url);
          try {
            const res = await fetch(url);
            if (!res.ok) { errCount++; continue; }
            const ct = res.headers.get("content-type") || "";
            const buf = await res.arrayBuffer();
            if (ct.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
              const src = await PDFDocument.load(buf, { ignoreEncryption: true });
              const pages = await merged.copyPages(src, src.getPageIndices());
              pages.forEach(p => merged.addPage(p));
              okCount++;
            } else if (ct.includes("image") || /\.(jpe?g|png)$/i.test(url)) {
              const isPng = ct.includes("png") || /\.png$/i.test(url);
              const img = isPng ? await merged.embedPng(buf) : await merged.embedJpg(buf);
              const page = merged.addPage([img.width, img.height]);
              page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
              okCount++;
            } else {
              errCount++;
            }
          } catch (e) {
            console.warn("Falha em", url, e);
            errCount++;
          }
        }
      }

      if (okCount === 0) { toast.error("Nenhum anexo pôde ser mesclado"); return; }
      const bytes = await merged.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      saveAs(blob, sysCfvFileName("PrestacaoContas_Consolidado", "pdf", mesRef));
      toast.success(`PDF consolidado gerado (${okCount} anexos${errCount ? `, ${errCount} ignorados` : ""})`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao consolidar PDF: " + (err?.message || ""));
    } finally {
      setPdfConsolidadoLoading(false);
    }
  };

  const severityIcon = (s: string) => {
    if (s === "erro") return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (s === "alerta") return <Info className="h-4 w-4 text-amber-500" />;
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<DollarSign className="h-5 w-5" />}
        title="Financeiro"
        subtitle="Orçamentos, despesas e prestação de contas"
        actions={
          <Select value={mesRef} onValueChange={setMesRef}>
            <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {/* Relatórios & Exportações */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-muted-foreground self-center mr-1">Exportar:</span>
            <Button variant="outline" size="sm" onClick={async () => { await generateREO("docx"); await generateREO("xlsx"); }} disabled={reoLoading} className="gap-1">
              {reoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              REO (DOCX + XLSX)
            </Button>
            <div className="w-px h-6 bg-border self-center" />
            <Button variant="outline" size="sm" onClick={async () => { await Promise.all([generatePrestacaoContas("pdf"), generatePrestacaoContas("xlsx")]); }} disabled={pcLoading} className="gap-1">
              {pcLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Prest. Contas (PDF + XLSX)
            </Button>
            <div className="w-px h-6 bg-border self-center" />
            <Button variant="outline" size="sm" onClick={generateDespesaTxt} className="gap-1">
              <Download className="h-3 w-3" />Exportar SIT
            </Button>
            <Button variant="outline" size="sm" onClick={generateRCA} disabled={rcaLoading} className="gap-1">
              {rcaLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Gerar RCA
            </Button>
          </div>
        </CardContent>
      </Card>

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

      <ExportacaoSitCard />

      <Tabs defaultValue="despesas">
        <TabsList className="grid grid-cols-9 w-full">
          <TabsTrigger value="despesas" className="text-xs gap-1"><Receipt className="h-3 w-3 hidden sm:block" />Despesas</TabsTrigger>
          <TabsTrigger value="parcelas" className="text-xs gap-1"><DollarSign className="h-3 w-3 hidden sm:block" />Parcelas</TabsTrigger>
          <TabsTrigger value="categorias" className="text-xs gap-1"><Layers className="h-3 w-3 hidden sm:block" />Categorias</TabsTrigger>
          <TabsTrigger value="estornos" className="text-xs gap-1"><Undo2 className="h-3 w-3 hidden sm:block" />Estornos</TabsTrigger>
          <TabsTrigger value="orcamentos" className="text-xs gap-1"><ClipboardList className="h-3 w-3 hidden sm:block" />Orçamentos</TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs gap-1"><FolderOpen className="h-3 w-3 hidden sm:block" />Documentos</TabsTrigger>
          <TabsTrigger value="importar" className="text-xs gap-1"><Upload className="h-3 w-3 hidden sm:block" />Importar</TabsTrigger>
          <TabsTrigger value="lotes" className="text-xs gap-1"><FileSpreadsheet className="h-3 w-3 hidden sm:block" />Lotes</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs gap-1"><ShieldCheck className="h-3 w-3 hidden sm:block" />Auditoria</TabsTrigger>
        </TabsList>

        <RegularizarSitDialog
          open={!!regularizarTarget}
          onOpenChange={(v) => { if (!v) setRegularizarTarget(null); }}
          despesa={regularizarTarget}
          onSaved={load}
        />

        {/* =================== REVISÃO PRÉ-LANÇAMENTO =================== */}
        <ImportReviewDialog
          open={reviewOpen}
          onOpenChange={(v) => !savingDocs && setReviewOpen(v)}
          docs={docFiles.map((d) => ({
            fileName: d.file.name,
            storageUrl: d.storageUrl,
            extractedList: d.extractedList,
          }))}
          mesRef={mesRef}
          saving={savingDocs}
          isCoordenacao={isCoordenacao}
          categorias={categorias}
          onUpdateField={updateDocExtracted}
          onRemoveDespesa={removeDespesa}
          onConfirm={confirmAndSaveImportedDocs}
        />

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
              {/* Pipeline summary & filters */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Button size="sm" variant={despFilter === "all" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => setDespFilter("all")}>
                  Todas ({despesas.length})
                </Button>
                <Button size="sm" variant={despFilter === "completa" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => setDespFilter("completa")}>
                  <CheckCircle2 className="h-3 w-3" />Completas ({despCompletas})
                </Button>
                <Button size="sm" variant={despFilter === "aguardando" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => setDespFilter("aguardando")}>
                  <Loader2 className="h-3 w-3" />Aguardando ({despAguardando})
                </Button>
                <Button size="sm" variant={despFilter === "pendente" ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => setDespFilter("pendente")}>
                  <AlertTriangle className="h-3 w-3" />Pendentes ({despPendentes})
                </Button>
              </div>
              <div className="overflow-auto">
                <Table><TableHeader><TableRow>
                  <TableHead className="text-xs">Cód.</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs">Fornecedor</TableHead>
                  <TableHead className="text-xs">Categoria</TableHead>
                  <TableHead className="text-xs text-right">Valor</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Docs</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredDespesas.map(d => {
                    const st = despStatus(d);
                    return (
                    <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditDesp({ ...d })}>
                      <TableCell className="text-xs">{d.codigo_lancamento || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{d.descricao}</TableCell>
                      <TableCell className="text-xs">{(d as any).fornecedor || "—"}</TableCell>
                      <TableCell className="text-xs">{d.categoria_id ? (catMap.get(d.categoria_id)?.codigo || "—") : "—"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmt(Number(d.valor))}</TableCell>
                      <TableCell className="text-xs">{d.data_lancamento}</TableCell>
                      <TableCell className="text-xs">
                        <Badge 
                          variant={st === "completa" ? "default" : "secondary"} 
                          className={`text-[10px] ${st === "completa" ? "bg-emerald-600 hover:bg-emerald-700" : st === "aguardando" ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-red-500 hover:bg-red-600 text-white"}`}
                        >
                          {st === "completa" ? "✅ Pago" : st === "aguardando" ? "⏳ Aguardando" : "⚠️ Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex gap-0.5">
                          {d.nota_url && <Badge variant="outline" className="text-[9px] px-1 py-0">NF</Badge>}
                          {d.boleto_url && <Badge variant="outline" className="text-[9px] px-1 py-0">Bol</Badge>}
                          {d.comprovante_url && <Badge variant="outline" className="text-[9px] px-1 py-0">Comp</Badge>}
                          {(d as any).sit_completo ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 cursor-pointer bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20"
                              onClick={(e) => { e.stopPropagation(); setRegularizarTarget(d); }}
                              title="Pronta para exportação SIT — clique para revisar"
                            >
                              ✓ SIT
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 cursor-pointer bg-blue-500/10 text-blue-700 border-blue-500/30 hover:bg-blue-500/20"
                              onClick={(e) => { e.stopPropagation(); setRegularizarTarget(d); }}
                              title="Regularizar para exportação SIT"
                            >
                              Regularizar SIT
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ table: "despesas", id: d.id, label: `Despesa: ${d.descricao} - ${fmt(Number(d.valor))}` }); }}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
                    </TableRow>
                  );})}
                  {filteredDespesas.length === 0 && <TableRow><TableCell colSpan={9} className="text-xs text-center text-muted-foreground py-6">Nenhuma despesa {despFilter !== "all" ? "com este filtro" : "neste mês"}</TableCell></TableRow>}
                </TableBody></Table>
              </div>
            </CardContent>
          </Card>

          {/* Dialog editar despesa */}
          <Dialog open={!!editDesp} onOpenChange={v => { if (!v) setEditDesp(null); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Editar Despesa</DialogTitle></DialogHeader>
              {editDesp && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Código Lançamento</Label><Input value={editDesp.codigo_lancamento || ""} onChange={e => setEditDesp(p => p ? { ...p, codigo_lancamento: e.target.value } : p)} /></div>
                    <div><Label className="text-xs">Data *</Label><Input type="date" value={editDesp.data_lancamento} onChange={e => setEditDesp(p => p ? { ...p, data_lancamento: e.target.value } : p)} /></div>
                  </div>
                  <div><Label className="text-xs">Descrição *</Label><Input value={editDesp.descricao} onChange={e => setEditDesp(p => p ? { ...p, descricao: e.target.value } : p)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={editDesp.valor} onChange={e => setEditDesp(p => p ? { ...p, valor: Number(e.target.value) } : p)} /></div>
                    <div><Label className="text-xs">Tipo Documento</Label>
                      <Select value={editDesp.tipo_documento || "nota_fiscal"} onValueChange={v => setEditDesp(p => p ? { ...p, tipo_documento: v } : p)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Fornecedor</Label><Input value={editDesp.fornecedor || ""} onChange={e => setEditDesp(p => p ? { ...p, fornecedor: e.target.value } : p)} /></div>
                    <div><Label className="text-xs">CNPJ/CPF</Label><Input value={editDesp.cnpj_cpf || ""} onChange={e => setEditDesp(p => p ? { ...p, cnpj_cpf: e.target.value } : p)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Nº Documento</Label><Input value={editDesp.numero_documento || ""} onChange={e => setEditDesp(p => p ? { ...p, numero_documento: e.target.value } : p)} /></div>
                    <div><Label className="text-xs">Categoria</Label>
                      <Select value={editDesp.categoria_id || ""} onValueChange={v => setEditDesp(p => p ? { ...p, categoria_id: v } : p)}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.descricao}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label className="text-xs">Comprovante de Pagamento (URL)</Label>
                    <Input value={editDesp.comprovante_url || ""} onChange={e => setEditDesp(p => p ? { ...p, comprovante_url: e.target.value } : p)} placeholder="URL do comprovante" />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {editDesp.comprovante_url ? "✓ Comprovante anexado — Status: Pago" : "⏳ Sem comprovante — Status: Aguardando Pagamento"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Nota Fiscal (URL)</Label>
                      <Input value={editDesp.nota_url || ""} onChange={e => setEditDesp(p => p ? { ...p, nota_url: e.target.value } : p)} placeholder="URL da NF" />
                    </div>
                    <div><Label className="text-xs">Boleto (URL)</Label>
                      <Input value={editDesp.boleto_url || ""} onChange={e => setEditDesp(p => p ? { ...p, boleto_url: e.target.value } : p)} placeholder="URL do boleto" />
                    </div>
                  </div>
                  <Button onClick={updateDespesa} className="w-full" disabled={editSaving}>
                    {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar Alterações
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget({ table: "parcelas_financeiras", id: p.id, label: `Parcela ${p.numero_parcela}: ${fmt(Number(p.valor))}` })}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
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
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget({ table: "categorias_financeiras", id: c.id, label: `Categoria ${c.codigo}: ${c.descricao}` })}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
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
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget({ table: "estornos", id: e.id, label: `Estorno: ${fmt(Number(e.valor))}` })}><Trash2 className="h-3 w-3 text-destructive" /></Button></TableCell>
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
                        {doc.extractedList && doc.extractedList.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-[11px] font-medium text-muted-foreground">
                              {doc.extractedList.length} despesa(s) detectada(s){doc.extractedList.length > 1 && " — uma por funcionário/comprovante"}
                            </div>
                            {doc.extractedList.map((extr, dIdx) => (
                              <div key={dIdx} className="border rounded p-2 bg-muted/20">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold">Despesa #{dIdx + 1}</span>
                                    {(() => {
                                      const v = validatedDocs[idx]?.items[dIdx];
                                      if (!v) return null;
                                      if (v.missing.length > 0) {
                                        return (
                                          <Badge variant="destructive" className="text-[9px] h-4 px-1 gap-0.5">
                                            <AlertTriangle className="h-2.5 w-2.5" />
                                            {v.missing.length} campo(s) obrigatório(s)
                                          </Badge>
                                        );
                                      }
                                      if (v.warnings.length > 0) {
                                        return (
                                          <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-amber-400 text-amber-700">
                                            <Info className="h-2.5 w-2.5" />
                                            {v.warnings.length} ajuste(s)
                                          </Badge>
                                        );
                                      }
                                      return (
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-emerald-400 text-emerald-700">
                                          <CheckCircle2 className="h-2.5 w-2.5" />
                                          OK
                                        </Badge>
                                      );
                                    })()}
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeDespesa(idx, dIdx)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                                {(() => {
                                  const v = validatedDocs[idx]?.items[dIdx];
                                  if (!v || (v.missing.length === 0 && v.warnings.length === 0)) return null;
                                  return (
                                    <ul className="mb-2 text-[10px] space-y-0.5">
                                      {v.missing.map((m) => (
                                        <li key={`m-${m}`} className="text-destructive">
                                          • <strong>{missingFieldLabel(m)}</strong> — campo obrigatório ausente
                                        </li>
                                      ))}
                                      {v.warnings.map((w, wi) => (
                                        <li
                                          key={`w-${wi}`}
                                          className={
                                            w.severity === "error"
                                              ? "text-destructive"
                                              : w.severity === "warn"
                                              ? "text-amber-700"
                                              : "text-muted-foreground"
                                          }
                                        >
                                          • <strong>{w.label}:</strong> {w.message}
                                        </li>
                                      ))}
                                    </ul>
                                  );
                                })()}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <div><Label className="text-[10px]">Descrição</Label>
                                    <Input className="h-7 text-xs" value={extr.descricao || ""} onChange={e => updateDocExtracted(idx, dIdx, "descricao", e.target.value)} /></div>
                                  <div><Label className="text-[10px]">Valor (R$)</Label>
                                    <Input className="h-7 text-xs" type="number" step="0.01" value={extr.valor || ""} onChange={e => updateDocExtracted(idx, dIdx, "valor", e.target.value)} /></div>
                                  <div><Label className="text-[10px]">Data</Label>
                                    <Input className="h-7 text-xs" type="date" value={extr.data_lancamento || ""} onChange={e => updateDocExtracted(idx, dIdx, "data_lancamento", e.target.value)} /></div>
                                  <div><Label className="text-[10px]">Favorecido</Label>
                                    <Input className="h-7 text-xs" value={extr.fornecedor || extr.sit_nome_favorecido || ""} onChange={e => updateDocExtracted(idx, dIdx, "fornecedor", e.target.value)} /></div>
                                  <div><Label className="text-[10px]">CPF/CNPJ</Label>
                                    <Input className="h-7 text-xs" value={extr.cnpj_cpf || ""} onChange={e => updateDocExtracted(idx, dIdx, "cnpj_cpf", e.target.value)} /></div>
                                  <div><Label className="text-[10px]">Nº Doc Despesa</Label>
                                    <Input className="h-7 text-xs" value={extr.sit_numero_doc_despesa || extr.numero_documento || ""} onChange={e => updateDocExtracted(idx, dIdx, "sit_numero_doc_despesa", e.target.value)} /></div>
                                  <div><Label className="text-[10px]">Tipo Doc Despesa (SIT)</Label>
                                    <Select value={String(extr.sit_tipo_doc_despesa ?? "")} onValueChange={v => updateDocExtracted(idx, dIdx, "sit_tipo_doc_despesa", Number(v))}>
                                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">1 — Nota Fiscal</SelectItem>
                                        <SelectItem value="4">4 — Recibo</SelectItem>
                                        <SelectItem value="5">5 — Boleto</SelectItem>
                                        <SelectItem value="6">6 — Folha de Pagamento</SelectItem>
                                        <SelectItem value="7">7 — RPA</SelectItem>
                                        <SelectItem value="8">8 — DARF</SelectItem>
                                        <SelectItem value="9">9 — GPS</SelectItem>
                                        <SelectItem value="20">20 — Outros</SelectItem>
                                      </SelectContent>
                                    </Select></div>
                                  <div><Label className="text-[10px]">Tipo Pagamento (SIT)</Label>
                                    <Select value={String(extr.sit_tipo_doc_pagamento ?? "")} onValueChange={v => updateDocExtracted(idx, dIdx, "sit_tipo_doc_pagamento", Number(v))}>
                                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="1">1 — Cheque</SelectItem>
                                        <SelectItem value="3">3 — TED/DOC/PIX</SelectItem>
                                        <SelectItem value="4">4 — Débito Automático</SelectItem>
                                        <SelectItem value="5">5 — Boleto</SelectItem>
                                      </SelectContent>
                                    </Select></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />Processando com IA...
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between rounded-md border bg-muted/30 p-2">
                    <div className="text-[11px] flex flex-wrap gap-2 items-center">
                      <Badge variant="outline" className="text-[10px]">
                        Total: {totalImportDespesas}
                      </Badge>
                      {totalWithMissing > 0 && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" /> {totalWithMissing} bloqueada(s)
                        </Badge>
                      )}
                      {totalWithWarnings > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-700">
                          <Info className="h-3 w-3" /> {totalWithWarnings} com ajuste(s)
                        </Badge>
                      )}
                    </div>
                    <Button onClick={openReview} disabled={totalImportDespesas === 0}>
                      Revisar e lançar {totalImportDespesas} despesa(s)
                    </Button>
                  </div>
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
        {/* =================== LOTES IMPORTADOS =================== */}
        <TabsContent value="lotes">
          <LotesImportadosTab />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation with justificativa */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) { setDeleteTarget(null); setDeleteJustificativa(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.label}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Justificativa *</Label>
            <Textarea
              placeholder="Informe o motivo da exclusão..."
              value={deleteJustificativa}
              onChange={e => setDeleteJustificativa(e.target.value)}
              className="text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRow} disabled={deleteLoading || !deleteJustificativa.trim()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
