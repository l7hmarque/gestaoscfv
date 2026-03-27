import { useState, useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const ParticipanteNovoPage = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [pontos, setPontos] = useState<Tables<"pontos_transporte">[]>([]);

  const [form, setForm] = useState({
    nome_completo: "", data_nascimento: "", genero: "", cor_raca: "",
    escola: "", serie: "", periodo: "manha" as string,
    endereco_rua: "", endereco_numero: "", endereco_bairro: "",
    bairro_id: "", ponto_transporte_id: "",
    responsavel1_nome: "", responsavel1_cpf: "", responsavel1_whatsapp: "",
    responsavel2_nome: "", responsavel2_whatsapp: "",
    origem_encaminhamento: "", responsavel_tecnico: "",
    categoria_vulnerabilidade: "", situacao_moradia: "", uf_origem: "",
    restricao_alimentar: "", laudo: "", iniciou_em: "",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome"),
    ]).then(([{ data: b }, { data: p }]) => {
      setBairros(b || []);
      setPontos(p || []);
    });
  }, []);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.bairro_id) delete payload.bairro_id;
    if (!payload.ponto_transporte_id) delete payload.ponto_transporte_id;
    if (!payload.data_nascimento) delete payload.data_nascimento;
    if (!payload.iniciou_em) delete payload.iniciou_em;
    const { error } = await supabase.from("participantes").insert(payload as any);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Participante cadastrado!");
    navigate("/participantes");
  };

  const Field = ({ label, field, type = "text", placeholder = "", half = false }: { label: string; field: string; type?: string; placeholder?: string; half?: boolean }) => (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <Label className="text-xs font-medium">{label}</Label>
      <Input type={type} value={(form as any)[field]} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} className="h-9 text-sm mt-1" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Participante</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dados Pessoais */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Nome Completo *</Label>
              <Input value={form.nome_completo} onChange={(e) => set("nome_completo", e.target.value)} placeholder="Nome completo do participante" className="h-9 text-sm mt-1" required />
            </div>
            <Field label="Data de Nascimento" field="data_nascimento" type="date" half />
            <div>
              <Label className="text-xs font-medium">Gênero</Label>
              <Select value={form.genero} onValueChange={(v) => set("genero", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Cor/Raça</Label>
              <Select value={form.cor_raca} onValueChange={(v) => set("cor_raca", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="branca">Branca</SelectItem>
                  <SelectItem value="preta">Preta</SelectItem>
                  <SelectItem value="parda">Parda</SelectItem>
                  <SelectItem value="amarela">Amarela</SelectItem>
                  <SelectItem value="indigena">Indígena</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Período</Label>
              <Select value={form.periodo} onValueChange={(v) => set("periodo", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manha">Manhã</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="integral">Integral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Escola */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Escolaridade</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Escola" field="escola" placeholder="Nome da escola" half />
            <Field label="Série/Ano" field="serie" placeholder="Ex: 5º ano" half />
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Rua" field="endereco_rua" placeholder="Nome da rua" />
            <Field label="Número" field="endereco_numero" placeholder="Nº" half />
            <Field label="Bairro (texto)" field="endereco_bairro" placeholder="Bairro" half />
            <div>
              <Label className="text-xs font-medium">Bairro (cadastrado)</Label>
              <Select value={form.bairro_id} onValueChange={(v) => set("bairro_id", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{bairros.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Ponto de Transporte</Label>
              <Select value={form.ponto_transporte_id} onValueChange={(v) => set("ponto_transporte_id", v)}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{pontos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Field label="UF de Origem" field="uf_origem" placeholder="Ex: PR" half />
            <Field label="Situação de Moradia" field="situacao_moradia" placeholder="Própria, alugada..." half />
          </CardContent>
        </Card>

        {/* Responsáveis */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Responsáveis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Responsável 1 - Nome" field="responsavel1_nome" placeholder="Nome completo" />
            <Field label="CPF" field="responsavel1_cpf" placeholder="000.000.000-00" half />
            <Field label="WhatsApp" field="responsavel1_whatsapp" placeholder="(00) 00000-0000" half />
            <Field label="Responsável 2 - Nome" field="responsavel2_nome" placeholder="Nome completo" />
            <Field label="WhatsApp" field="responsavel2_whatsapp" placeholder="(00) 00000-0000" half />
          </CardContent>
        </Card>

        {/* Informações Complementares */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Informações Complementares</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Field label="Origem/Encaminhamento" field="origem_encaminhamento" placeholder="CRAS, escola..." half />
            <Field label="Responsável Técnico" field="responsavel_tecnico" placeholder="Nome do técnico" half />
            <Field label="Categoria de Vulnerabilidade" field="categoria_vulnerabilidade" placeholder="Ex: situação de risco" half />
            <Field label="Início no SCFV" field="iniciou_em" type="date" half />
            <div className="col-span-2">
              <Label className="text-xs font-medium">Restrição Alimentar</Label>
              <Textarea value={form.restricao_alimentar} onChange={(e) => set("restricao_alimentar", e.target.value)} placeholder="Alergias, intolerâncias..." className="text-sm mt-1 min-h-[60px]" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Laudo / Observações de Saúde</Label>
              <Textarea value={form.laudo} onChange={(e) => set("laudo", e.target.value)} placeholder="Informações médicas relevantes..." className="text-sm mt-1 min-h-[60px]" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" asChild><Link to="/participantes">Cancelar</Link></Button>
          <Button type="submit" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
};

export default ParticipanteNovoPage;
