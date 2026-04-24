import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Loader2, CheckCircle2, AlertTriangle, Building2, FileText, Landmark, UserCog } from "lucide-react";

interface SitCfg {
  id?: string;
  // Concedente
  cnpj_concedente: string;
  razao_social_concedente?: string;
  // OSC
  cnpj_osc?: string;
  razao_social_osc?: string;
  // Termo
  numero_instrumento_padrao: string;
  ano_transferencia_padrao: number;
  exercicio?: number;
  data_inicio_vigencia?: string;
  data_fim_vigencia?: string;
  valor_total_repasse?: number;
  objeto_termo?: string;
  tipo_transferencia_padrao: number;
  tipo_doc_pagamento_padrao: number;
  modalidade_compra_padrao: number;
  // Banco
  banco_codigo?: string;
  banco_nome?: string;
  banco_agencia?: string;
  banco_conta?: string;
  banco_tipo_conta?: string;
  // Gestor
  gestor_nome?: string;
  gestor_cpf?: string;
  gestor_cargo?: string;
  gestor_email?: string;
  observacoes?: string;
}

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

interface Check { label: string; ok: boolean; group: string }

function avaliar(cfg: SitCfg): Check[] {
  return [
    { group: "Concedente", label: "CNPJ do concedente (14 dígitos)", ok: onlyDigits(cfg.cnpj_concedente).length === 14 },
    { group: "Concedente", label: "Razão social do concedente", ok: !!cfg.razao_social_concedente?.trim() },
    { group: "OSC", label: "CNPJ da OSC (14 dígitos)", ok: onlyDigits(cfg.cnpj_osc).length === 14 },
    { group: "OSC", label: "Razão social da OSC", ok: !!cfg.razao_social_osc?.trim() },
    { group: "Termo", label: "Número do instrumento", ok: !!cfg.numero_instrumento_padrao?.trim() },
    { group: "Termo", label: "Ano da transferência", ok: !!cfg.ano_transferencia_padrao && cfg.ano_transferencia_padrao > 2000 },
    { group: "Termo", label: "Exercício", ok: !!cfg.exercicio && cfg.exercicio > 2000 },
    { group: "Termo", label: "Vigência (início e fim)", ok: !!cfg.data_inicio_vigencia && !!cfg.data_fim_vigencia },
    { group: "Termo", label: "Valor total do repasse", ok: !!cfg.valor_total_repasse && cfg.valor_total_repasse > 0 },
    { group: "Banco", label: "Banco (código + nome)", ok: !!cfg.banco_codigo?.trim() && !!cfg.banco_nome?.trim() },
    { group: "Banco", label: "Agência e conta", ok: !!cfg.banco_agencia?.trim() && !!cfg.banco_conta?.trim() },
    { group: "Gestor", label: "Nome do gestor", ok: !!cfg.gestor_nome?.trim() },
    { group: "Gestor", label: "CPF do gestor (11 dígitos)", ok: onlyDigits(cfg.gestor_cpf).length === 11 },
  ];
}

export default function ConfiguracoesSitTab() {
  const [cfg, setCfg] = useState<SitCfg>({
    cnpj_concedente: "",
    numero_instrumento_padrao: "",
    ano_transferencia_padrao: new Date().getFullYear(),
    exercicio: new Date().getFullYear(),
    tipo_transferencia_padrao: 1,
    tipo_doc_pagamento_padrao: 3,
    modalidade_compra_padrao: 7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("sit_configuracao" as any).select("*").maybeSingle();
      if (data) setCfg(data as any);
      setLoading(false);
    })();
  }, []);

  const checks = avaliar(cfg);
  const okCount = checks.filter(c => c.ok).length;
  const total = checks.length;
  const pct = Math.round((okCount / total) * 100);
  const ready = okCount === total;
  const grupos = ["Concedente", "OSC", "Termo", "Banco", "Gestor"];

  const set = <K extends keyof SitCfg>(k: K, v: SitCfg[K]) => setCfg(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload: any = { ...cfg };
    // sanitiza dígitos onde aplicável
    if (payload.cnpj_concedente) payload.cnpj_concedente = onlyDigits(payload.cnpj_concedente);
    if (payload.cnpj_osc) payload.cnpj_osc = onlyDigits(payload.cnpj_osc);
    if (payload.gestor_cpf) payload.gestor_cpf = onlyDigits(payload.gestor_cpf);
    let res;
    if (cfg.id) {
      res = await supabase.from("sit_configuracao" as any).update(payload).eq("id", cfg.id);
    } else {
      res = await supabase.from("sit_configuracao" as any).insert(payload).select().single();
      if (!res.error && res.data) setCfg(res.data as any);
    }
    setSaving(false);
    if (res.error) toast.error("Erro ao salvar: " + res.error.message);
    else toast.success("Configuração SIT salva!");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Status de prontidão */}
      <Card className={`border-l-4 ${ready ? "border-l-emerald-500" : "border-l-amber-500"}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                Prontidão SIT — {okCount} de {total} ({pct}%)
              </CardTitle>
              <CardDescription className="text-xs">
                {ready
                  ? "Todos os dados institucionais necessários estão preenchidos."
                  : "Preencha os campos abaixo para liberar a exportação no Financeiro."}
              </CardDescription>
            </div>
            <Badge variant="outline" className={ready ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" : "bg-amber-500/10 text-amber-700 border-amber-500/30"}>
              {ready ? "Pronto para exportar" : `${total - okCount} pendência(s)`}
            </Badge>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div className={`h-full transition-all ${ready ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                <span className={c.ok ? "text-emerald-600" : "text-rose-600"}>
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className="text-muted-foreground">[{c.group}]</span>
                <span className={c.ok ? "" : "font-medium"}>{c.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Concedente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Concedente (Órgão Público)</CardTitle>
          <CardDescription className="text-xs">Município, estado ou autarquia que repassa o recurso.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">CNPJ do Concedente *</Label>
            <Input className="mt-1" placeholder="00.000.000/0001-00" value={cfg.cnpj_concedente || ""}
              onChange={e => set("cnpj_concedente", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Razão Social *</Label>
            <Input className="mt-1" placeholder="Município de ..." value={cfg.razao_social_concedente || ""}
              onChange={e => set("razao_social_concedente", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* OSC */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> OSC (Convenente)</CardTitle>
          <CardDescription className="text-xs">Dados da entidade beneficiária do termo.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">CNPJ da OSC *</Label>
            <Input className="mt-1" placeholder="00.000.000/0001-00" value={cfg.cnpj_osc || ""}
              onChange={e => set("cnpj_osc", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Razão Social *</Label>
            <Input className="mt-1" value={cfg.razao_social_osc || ""}
              onChange={e => set("razao_social_osc", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Termo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Termo / Instrumento</CardTitle>
          <CardDescription className="text-xs">Convênio, Termo de Colaboração ou Termo de Fomento.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Nº do Termo *</Label>
            <Input className="mt-1" placeholder="001/2022" value={cfg.numero_instrumento_padrao || ""}
              onChange={e => set("numero_instrumento_padrao", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Ano Transferência *</Label>
            <Input type="number" className="mt-1" value={cfg.ano_transferencia_padrao || ""}
              onChange={e => set("ano_transferencia_padrao", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Exercício *</Label>
            <Input type="number" className="mt-1" value={cfg.exercicio || ""}
              onChange={e => set("exercicio", Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Tipo Transferência</Label>
            <Select value={String(cfg.tipo_transferencia_padrao || 1)} onValueChange={v => set("tipo_transferencia_padrao", Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Convênio</SelectItem>
                <SelectItem value="2">2 — Termo de Colaboração</SelectItem>
                <SelectItem value="3">3 — Termo de Fomento</SelectItem>
                <SelectItem value="4">4 — Acordo de Cooperação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Modalidade Compra (padrão)</Label>
            <Select value={String(cfg.modalidade_compra_padrao || 7)} onValueChange={v => set("modalidade_compra_padrao", Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Concorrência</SelectItem>
                <SelectItem value="2">2 — Tomada de Preços</SelectItem>
                <SelectItem value="3">3 — Convite</SelectItem>
                <SelectItem value="4">4 — Pregão</SelectItem>
                <SelectItem value="5">5 — Concurso</SelectItem>
                <SelectItem value="6">6 — Leilão</SelectItem>
                <SelectItem value="7">7 — Dispensa</SelectItem>
                <SelectItem value="8">8 — Inexigibilidade</SelectItem>
                <SelectItem value="9">9 — Não se aplica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo Doc. Pagamento (padrão)</Label>
            <Select value={String(cfg.tipo_doc_pagamento_padrao || 3)} onValueChange={v => set("tipo_doc_pagamento_padrao", Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 — Cheque</SelectItem>
                <SelectItem value="2">2 — Ordem Bancária</SelectItem>
                <SelectItem value="3">3 — Transferência (TED/PIX)</SelectItem>
                <SelectItem value="4">4 — Débito Automático</SelectItem>
                <SelectItem value="9">9 — Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Início Vigência *</Label>
            <Input type="date" className="mt-1" value={cfg.data_inicio_vigencia || ""}
              onChange={e => set("data_inicio_vigencia", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Fim Vigência *</Label>
            <Input type="date" className="mt-1" value={cfg.data_fim_vigencia || ""}
              onChange={e => set("data_fim_vigencia", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Valor Total do Repasse (R$) *</Label>
            <Input type="number" step="0.01" className="mt-1" value={cfg.valor_total_repasse ?? ""}
              onChange={e => set("valor_total_repasse", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Objeto do Termo</Label>
            <Textarea className="mt-1" rows={2} placeholder="Execução do Serviço de Convivência..." value={cfg.objeto_termo || ""}
              onChange={e => set("objeto_termo", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Banco */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Landmark className="h-4 w-4" /> Conta Bancária do Termo</CardTitle>
          <CardDescription className="text-xs">Conta exclusiva onde o repasse é depositado e movimentado.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Código do Banco *</Label>
            <Input className="mt-1" placeholder="001" value={cfg.banco_codigo || ""}
              onChange={e => set("banco_codigo", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Nome do Banco *</Label>
            <Input className="mt-1" placeholder="Banco do Brasil" value={cfg.banco_nome || ""}
              onChange={e => set("banco_nome", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Agência *</Label>
            <Input className="mt-1" value={cfg.banco_agencia || ""}
              onChange={e => set("banco_agencia", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Conta *</Label>
            <Input className="mt-1" value={cfg.banco_conta || ""}
              onChange={e => set("banco_conta", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo de Conta</Label>
            <Select value={cfg.banco_tipo_conta || ""} onValueChange={v => set("banco_tipo_conta", v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="aplicacao">Aplicação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Gestor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><UserCog className="h-4 w-4" /> Gestor / Responsável</CardTitle>
          <CardDescription className="text-xs">Pessoa que assina a prestação de contas.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nome Completo *</Label>
            <Input className="mt-1" value={cfg.gestor_nome || ""}
              onChange={e => set("gestor_nome", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CPF *</Label>
            <Input className="mt-1" placeholder="000.000.000-00" value={cfg.gestor_cpf || ""}
              onChange={e => set("gestor_cpf", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Cargo</Label>
            <Input className="mt-1" placeholder="Presidente, Diretor..." value={cfg.gestor_cargo || ""}
              onChange={e => set("gestor_cargo", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input type="email" className="mt-1" value={cfg.gestor_email || ""}
              onChange={e => set("gestor_email", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Observações + Salvar */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <Label className="text-xs">Observações Internas</Label>
            <Textarea className="mt-1" rows={2} value={cfg.observacoes || ""}
              onChange={e => set("observacoes", e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configuração SIT
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
