import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Upload, X, MapPin, FileDown, AlertTriangle, MessageCircle } from "lucide-react";
import { BAIRROS_SCFV } from "@/lib/constants";
import { maskCPF, maskPhone, unmaskDigits } from "@/lib/utils";

const DOC_CATEGORIES = [
  { value: "laudo", label: "Laudo Médico" },
  { value: "receita", label: "Receita" },
  { value: "comprovante_escolar", label: "Comprovante Escolar" },
  { value: "outro", label: "Outro" },
];

interface PendingDoc {
  file: File;
  categoria: string;
  preview?: string;
}

interface PontoTransporte {
  id: string;
  nome: string;
  horario_manha: string | null;
  horario_tarde: string | null;
}

const MAPS_LINK = "https://www.google.com/maps/d/edit?mid=16Zj-8IkR-08tLtP1LxhQouLxCmuDxYg&usp=sharing";

const WHATSAPP_LINKS: Record<string, string> = {
  ALVORADA: "https://chat.whatsapp.com/CMqGlJdUmRW0YKsGWdEZJK",
  "JARDIM IRENE": "https://chat.whatsapp.com/FTpkWJLY6TzIT25VgdmDft",
  "PARQUE INDEPENDENCIA": "https://chat.whatsapp.com/FTpkWJLY6TzIT25VgdmDft",
};

const Field = ({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
  onBlur?: () => void;
}) => (
  <div>
    <Label className="text-sm font-medium">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className="mt-1"
      placeholder={placeholder}
    />
  </div>
);

const MatriculaPublicaPage = () => {
  const [form, setForm] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [pontos, setPontos] = useState<PontoTransporte[]>([]);
  const [loadingPontos, setLoadingPontos] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedBairro, setSubmittedBairro] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadCategoria, setUploadCategoria] = useState("");
  const [estrangeiroCpf, setEstrangeiroCpf] = useState(false);

  // Re-enrollment state
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isRematricula, setIsRematricula] = useState(false);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Check for existing participant
  const checkExisting = useCallback(async (nome: string, dataNasc: string) => {
    if (!nome.trim() || !dataNasc) return;
    setChecking(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/public-check-participante`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome_completo: nome, data_nascimento: dataNasc }),
      });
      const data = await res.json();
      if (data.found && data.participante) {
        const p = data.participante;
        setExistingId(p.id);
        setIsRematricula(true);
        // Pre-fill form with existing data
        setForm((prev) => ({
          ...prev,
          nome_completo: p.nome_completo || prev.nome_completo || "",
          data_nascimento: p.data_nascimento || prev.data_nascimento || "",
          genero: p.genero || "",
          cor_raca: p.cor_raca || "",
          escola: p.escola || "",
          serie: p.serie || "",
          periodo: p.periodo || "",
          endereco_rua: p.endereco_rua || "",
          endereco_numero: p.endereco_numero || "",
          endereco_bairro: p.endereco_bairro || "",
          bairro_scfv: p.bairro_nome || "",
          ponto_transporte_id: p.ponto_transporte_id || "",
          restricao_alimentar: p.restricao_alimentar || "",
          laudo: p.laudo || "",
        }));
        // Load pontos if bairro exists
        if (p.bairro_nome) {
          loadPontos(p.bairro_nome);
        }
      } else {
        setExistingId(null);
        setIsRematricula(false);
      }
    } catch {
      // silently fail
    }
    setChecking(false);
  }, []);

  // Debounced check when name+dob change
  const triggerCheck = useCallback(
    (nome: string, dataNasc: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => checkExisting(nome, dataNasc), 800);
    },
    [checkExisting],
  );

  const handleNameBlur = () => {
    if (form.nome_completo) {
      const padronizado = form.nome_completo.trim().toUpperCase();
      set("nome_completo", padronizado);
      if (form.data_nascimento) triggerCheck(padronizado, form.data_nascimento);
    }
  };

  const handleDobChange = (val: string) => {
    set("data_nascimento", val);
    if (form.nome_completo?.trim() && val) {
      triggerCheck(form.nome_completo.trim().toUpperCase(), val);
    }
  };

  const loadPontos = async (bairroNome: string) => {
    setLoadingPontos(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-pontos?bairro_nome=${encodeURIComponent(bairroNome)}`,
        { headers: { "Content-Type": "application/json" } },
      );
      const data = await res.json();
      setPontos(data.pontos || []);
    } catch {
      setPontos([]);
    }
    setLoadingPontos(false);
  };

  const handleBairroChange = (bairroNome: string) => {
    set("bairro_scfv", bairroNome);
    set("ponto_transporte_id", "");
    loadPontos(bairroNome);
  };

  const triggerUpload = (categoria: string) => {
    setUploadCategoria(categoria);
    fileRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Envie apenas imagem ou PDF.");
      return;
    }
    try {
      const { compressFileForUpload } = await import("@/hooks/useDocumentScanner");
      const compressed = await compressFileForUpload(file);
      const preview = compressed.type.startsWith("image/") ? URL.createObjectURL(compressed) : undefined;
      // Replace existing doc of same category
      setDocs((prev) => [...prev.filter((d) => d.categoria !== uploadCategoria), { file: compressed, categoria: uploadCategoria, preview }]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar arquivo");
    }
  };

  const removeDoc = (index: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.nome_completo?.trim()) {
      alert("Nome completo é obrigatório");
      return;
    }
    if (!form.responsavel1_nome?.trim()) {
      alert("Nome do responsável é obrigatório");
      return;
    }
    if (!form.responsavel1_whatsapp?.trim()) {
      alert("WhatsApp do responsável é obrigatório");
      return;
    }

    setSubmitting(true);
    try {
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      const docsPayload = [];
      for (const doc of docs) {
        if (doc.file.size > MAX_FILE_SIZE) {
          alert(`Arquivo "${doc.file.name}" excede 5MB e será ignorado.`);
          continue;
        }
        const base64 = await fileToBase64(doc.file);
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        docsPayload.push({
          base64,
          categoria: doc.categoria,
          fileName: `matricula_${doc.categoria}_${ts}_${doc.file.name}`,
          contentType: doc.file.type || "application/octet-stream",
        });
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/public-matricula`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_completo: form.nome_completo,
          data_nascimento: form.data_nascimento || null,
          genero: form.genero || null,
          cor_raca: form.cor_raca || null,
          escola: form.escola || null,
          serie: form.serie || null,
          periodo: form.periodo || null,
          endereco_rua: form.endereco_rua || null,
          endereco_numero: form.endereco_numero || null,
          endereco_bairro: form.endereco_bairro || null,
          bairro_nome: form.bairro_scfv || null,
          ponto_transporte_id: form.ponto_transporte_id || null,
          responsavel1_nome: form.responsavel1_nome,
          responsavel1_cpf: null,
          cpf: form.responsavel1_cpf || null,
          responsavel1_whatsapp: form.responsavel1_whatsapp,
          responsavel2_nome: form.responsavel2_nome || null,
          responsavel2_whatsapp: form.responsavel2_whatsapp || null,
          restricao_alimentar: form.restricao_alimentar || null,
          laudo: form.laudo || null,
          documentos: docsPayload,
          existing_id: existingId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao enviar matrícula");

      setSubmittedBairro(form.bairro_scfv || "");
      setSubmitted(true);
      if (result.rematricula) {
        console.info("Rematrícula automática detectada pelo backend");
      }
    } catch (err: any) {
      alert("Erro ao enviar: " + (err.message || "Tente novamente"));
    }
    setSubmitting(false);
  };

  if (submitted) {
    const whatsappLink = WHATSAPP_LINKS[submittedBairro] || "";
    return (
      <div className="min-h-screen bg-[hsl(40,20%,97%)] flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-5">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">
              {isRematricula ? "Rematrícula Enviada!" : "Matrícula Enviada!"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Agradecemos por confiar no nosso trabalho! A equipe do <strong>CAIA 🌍 Medianeira</strong> irá analisar os
              dados e entrar em contato pelo WhatsApp informado.
            </p>

            {whatsappLink && (
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium text-foreground">
                  Entre no grupo do WhatsApp do seu bairro para receber informações e novidades:
                </p>
                <Button
                  className="w-full h-12 text-base font-semibold gap-2"
                  style={{ backgroundColor: "#25D366", color: "#fff" }}
                  asChild
                >
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-5 w-5" />
                    Entrar no Grupo do WhatsApp
                  </a>
                </Button>
              </div>
            )}

            <Button
              onClick={() => {
                setSubmitted(false);
                setForm({});
                setDocs([]);
                setExistingId(null);
                setIsRematricula(false);
                setSubmittedBairro("");
              }}
              variant="outline"
            >
              Fazer outra matrícula
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(40,20%,97%)]">
      {/* Header */}
      <div className="bg-[hsl(0,65%,67%)] text-white py-6 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold">Matrícula Online — CAIA 🌎</h1>
          <p className="text-sm mt-2 opacity-90">Centro de Atencao Integral ao Adolescente</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Subtitle / Term download */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Após realizar a matrícula, é necessário assinar e nos enviar o{" "}
              <strong>Termo de Autorização de Uso de Imagem</strong>.
            </p>
            <Button variant="outline" size="sm" className="mt-2 gap-2" asChild>
              <a
                href="https://drive.google.com/file/d/1SOjU9Rmy9vHl85bO4cBe6WNxVdy9NrTv/view"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown className="h-4 w-4" />
                Abrir Termo de Uso de Imagem
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Re-enrollment alert */}
        {isRematricula && (
          <Alert className="border-yellow-400 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              Este participante já possui cadastro! Confira e atualize os dados abaixo.
            </AlertDescription>
          </Alert>
        )}

        {checking && (
          <p className="text-xs text-muted-foreground text-center animate-pulse">Verificando cadastro existente...</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados da Criança */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dados da Criança / Adolescente</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Nome Completo" value={form.nome_completo || ""} onChange={(v) => set("nome_completo", v)} required onBlur={handleNameBlur} />
              </div>
              <div>
                <Label className="text-sm font-medium">
                  Data de Nascimento<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.data_nascimento || ""}
                  onChange={(e) => handleDobChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Gênero</Label>
                <Select value={form.genero || ""} onValueChange={(v) => set("genero", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Cor/Raça</Label>
                <Select value={form.cor_raca || ""} onValueChange={(v) => set("cor_raca", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branca">Branca</SelectItem>
                    <SelectItem value="preta">Preta</SelectItem>
                    <SelectItem value="parda">Parda</SelectItem>
                    <SelectItem value="amarela">Amarela</SelectItem>
                    <SelectItem value="indigena">Indígena</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Escola" value={form.escola || ""} onChange={(v) => set("escola", v)} />
              <Field label="Série / Ano" value={form.serie || ""} onChange={(v) => set("serie", v)} />
            </CardContent>
          </Card>

          {/* Período e Local */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Período e Local</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium">Período Desejado</Label>
                <Select value={form.periodo || ""} onValueChange={(v) => set("periodo", v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Bairro do CAIA que vai frequentar</Label>
                <Select value={form.bairro_scfv || ""} onValueChange={handleBairroChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o bairro" />
                  </SelectTrigger>
                  <SelectContent>
                    {BAIRROS_SCFV.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.bairro_scfv && (
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium">Ponto de Transporte</Label>
                  {loadingPontos ? (
                    <p className="text-xs text-muted-foreground mt-1">Carregando pontos...</p>
                  ) : pontos.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">Nenhum ponto disponível para este bairro.</p>
                  ) : (
                    <Select value={form.ponto_transporte_id || ""} onValueChange={(v) => set("ponto_transporte_id", v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione o ponto" />
                      </SelectTrigger>
                      <SelectContent>
                        {pontos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                            {p.horario_manha ? ` (M: ${p.horario_manha})` : ""}
                            {p.horario_tarde ? ` (T: ${p.horario_tarde})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <a
                    href={MAPS_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                  >
                    <MapPin className="h-3 w-3" />
                    Confira a localização dos pontos no mapa
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Endereço</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Field label="Rua" value={form.endereco_rua || ""} onChange={(v) => set("endereco_rua", v)} />
              </div>
              <Field label="Número" value={form.endereco_numero || ""} onChange={(v) => set("endereco_numero", v)} />
              <Field label="Bairro" value={form.endereco_bairro || ""} onChange={(v) => set("endereco_bairro", v)} />
            </CardContent>
          </Card>

          {/* Responsáveis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Responsável</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Nome do Responsável" value={form.responsavel1_nome || ""} onChange={(v) => set("responsavel1_nome", v)} required />
                <div>
                  <Label className="text-sm font-medium">CPF do Participante</Label>
                  <Input
                    value={estrangeiroCpf ? (form.responsavel1_cpf || "") : maskCPF(form.responsavel1_cpf || "")}
                    onChange={(e) => set("responsavel1_cpf", estrangeiroCpf ? e.target.value : unmaskDigits(e.target.value))}
                    className="mt-1"
                    placeholder={estrangeiroCpf ? "Documento" : "000.000.000-00"}
                  />
                  <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                    <input type="checkbox" checked={estrangeiroCpf} onChange={(e) => setEstrangeiroCpf(e.target.checked)} className="h-3 w-3" />
                    <span className="text-xs text-muted-foreground">Estrangeiro/Sem CPF</span>
                  </label>
                </div>
                <div>
                  <Label className="text-sm font-medium">WhatsApp<span className="text-destructive ml-0.5">*</span></Label>
                  <Input
                    value={maskPhone(form.responsavel1_whatsapp || "")}
                    onChange={(e) => set("responsavel1_whatsapp", unmaskDigits(e.target.value))}
                    className="mt-1"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Responsável 2 (opcional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nome" value={form.responsavel2_nome || ""} onChange={(v) => set("responsavel2_nome", v)} />
                  <div>
                    <Label className="text-sm font-medium">WhatsApp</Label>
                    <Input
                      value={maskPhone(form.responsavel2_whatsapp || "")}
                      onChange={(e) => set("responsavel2_whatsapp", unmaskDigits(e.target.value))}
                      className="mt-1"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saúde */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Informações de Saúde</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Restrição Alimentar</Label>
                <Textarea
                  value={form.restricao_alimentar || ""}
                  onChange={(e) => set("restricao_alimentar", e.target.value)}
                  className="mt-1 min-h-[60px]"
                  placeholder="Ex: alergia a glúten, intolerância a lactose..."
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Observações de Saúde / Laudo</Label>
                <Textarea
                  value={form.laudo || ""}
                  onChange={(e) => set("laudo", e.target.value)}
                  className="mt-1 min-h-[60px]"
                  placeholder="Informe se a criança possui algum laudo ou condição de saúde relevante..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Envie fotos ou PDFs dos documentos. Você pode enviar mais de um arquivo por categoria.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DOC_CATEGORIES.map((cat) => {
                  const count = docs.filter((d) => d.categoria === cat.value).length;
                  return (
                    <Button
                      key={cat.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 flex-col gap-1 relative"
                      onClick={() => triggerUpload(cat.value)}
                    >
                      <Upload className="h-4 w-4" />
                      {cat.label}
                      {count > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1.5 -right-1.5 text-[10px] h-5 w-5 p-0 flex items-center justify-center"
                        >
                          {count}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {docs.length > 0 && (
                <div className="space-y-1.5">
                  {docs.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded p-2 text-xs">
                      <span className="font-medium">
                        {DOC_CATEGORIES.find((c) => c.value === doc.categoria)?.label}:
                      </span>
                      <span className="truncate flex-1">{doc.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeDoc(i)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelected}
                
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={submitting}>
            {submitting ? "Enviando matrícula..." : isRematricula ? "Enviar Rematrícula" : "Enviar Matrícula"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground pb-6">SysELO — Sistema de Gestão SCFV</p>
      </div>
    </div>
  );
};

export default MatriculaPublicaPage;
