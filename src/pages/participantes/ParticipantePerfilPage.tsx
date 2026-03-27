import { useState, useEffect } from "react";
import { ArrowLeft, Save, Pencil, Printer, FileText, FileSpreadsheet } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportFichaInscricaoDocx, exportFichaInscricaoPdf } from "@/hooks/useDocumentExport";
import type { Tables } from "@/integrations/supabase/types";

const statusLabel: Record<string, string> = { ativo: "Ativo", desligado: "Desligado", incompleto: "Incompleto" };
const periodoLabel: Record<string, string> = { manha: "Manhã", tarde: "Tarde", integral: "Integral" };

const ParticipantePerfilPage = () => {
  const { id } = useParams();
  const [participante, setParticipante] = useState<Tables<"participantes"> | null>(null);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [pontos, setPontos] = useState<Tables<"pontos_transporte">[]>([]);
  const [turmas, setTurmas] = useState<{ turma_id: string; turma_nome: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: b }, { data: pt }, { data: tp }] = await Promise.all([
      supabase.from("participantes").select("*").eq("id", id!).single(),
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome"),
      supabase.from("turma_participantes").select("turma_id, turmas(nome)").eq("participante_id", id!),
    ]);
    setParticipante(p);
    setBairros(b || []);
    setPontos(pt || []);
    setTurmas((tp || []).map((t: any) => ({ turma_id: t.turma_id, turma_nome: t.turmas?.nome || "" })));
    if (p) {
      const f: Record<string, string> = {};
      Object.entries(p).forEach(([k, v]) => { f[k] = v == null ? "" : String(v); });
      setForm(f);
    }
    setLoading(false);
  };

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    ["bairro_id", "ponto_transporte_id", "data_nascimento", "iniciou_em"].forEach((k) => { if (!payload[k]) payload[k] = null; });
    const { error } = await supabase.from("participantes").update(payload as any).eq("id", id!);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Atualizado com sucesso!");
    setEditing(false);
    fetchAll();
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!participante) return <div className="text-center py-12 text-muted-foreground">Participante não encontrado.</div>;

  const Info = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div><span className="text-xs text-muted-foreground">{label}</span><p className="text-sm">{value || "—"}</p></div>
  );

  const EditField = ({ label, field, type = "text" }: { label: string; field: string; type?: string }) => (
    <div><Label className="text-xs">{label}</Label><Input type={type} value={form[field] || ""} onChange={(e) => set(field, e.target.value)} className="h-8 text-sm mt-0.5" /></div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{participante.nome_completo}</h1>
            <div className="flex gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">{statusLabel[participante.status || "ativo"]}</Badge>
              {participante.periodo && <Badge variant="outline" className="text-xs">{periodoLabel[participante.periodo]}</Badge>}
            </div>
          </div>
        </div>
        {!editing ? (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" />Imprimir</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><FileText className="h-3.5 w-3.5" />Ficha</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportFichaInscricaoDocx(participante)} className="text-xs gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportFichaInscricaoPdf(participante)} className="text-xs gap-2"><FileText className="h-3.5 w-3.5" /> PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        )}
      </div>

      {turmas.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {turmas.map((t) => <Badge key={t.turma_id} variant="secondary" className="text-xs">{t.turma_nome}</Badge>)}
        </div>
      )}

      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <>
                <div className="col-span-2"><EditField label="Nome Completo" field="nome_completo" /></div>
                <EditField label="Data Nascimento" field="data_nascimento" type="date" />
                <div><Label className="text-xs">Gênero</Label>
                  <Select value={form.genero || ""} onValueChange={(v) => set("genero", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Cor/Raça</Label>
                  <Select value={form.cor_raca || ""} onValueChange={(v) => set("cor_raca", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="branca">Branca</SelectItem><SelectItem value="preta">Preta</SelectItem><SelectItem value="parda">Parda</SelectItem><SelectItem value="amarela">Amarela</SelectItem><SelectItem value="indigena">Indígena</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Período</Label>
                  <Select value={form.periodo || "manha"} onValueChange={(v) => set("periodo", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="integral">Integral</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={form.status || "ativo"} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="desligado">Desligado</SelectItem><SelectItem value="incompleto">Incompleto</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <Info label="Nome" value={participante.nome_completo} />
                <Info label="Data de Nascimento" value={participante.data_nascimento} />
                <Info label="Gênero" value={participante.genero} />
                <Info label="Cor/Raça" value={participante.cor_raca} />
                <Info label="Período" value={participante.periodo ? periodoLabel[participante.periodo] : null} />
                <Info label="Escola" value={participante.escola} />
                <Info label="Série" value={participante.serie} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <><EditField label="Rua" field="endereco_rua" /><EditField label="Número" field="endereco_numero" /><EditField label="Bairro" field="endereco_bairro" /><EditField label="UF Origem" field="uf_origem" /><EditField label="Sit. Moradia" field="situacao_moradia" /></>
            ) : (
              <><Info label="Rua" value={participante.endereco_rua} /><Info label="Número" value={participante.endereco_numero} /><Info label="Bairro" value={participante.endereco_bairro} /><Info label="UF Origem" value={participante.uf_origem} /><Info label="Sit. Moradia" value={participante.situacao_moradia} /></>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Responsáveis</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <><EditField label="Resp. 1 Nome" field="responsavel1_nome" /><EditField label="CPF" field="responsavel1_cpf" /><EditField label="WhatsApp" field="responsavel1_whatsapp" /><EditField label="Resp. 2 Nome" field="responsavel2_nome" /><EditField label="WhatsApp 2" field="responsavel2_whatsapp" /></>
            ) : (
              <><Info label="Resp. 1" value={participante.responsavel1_nome} /><Info label="CPF" value={participante.responsavel1_cpf} /><Info label="WhatsApp" value={participante.responsavel1_whatsapp} /><Info label="Resp. 2" value={participante.responsavel2_nome} /><Info label="WhatsApp 2" value={participante.responsavel2_whatsapp} /></>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Complementar</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {editing ? (
              <>
                <EditField label="Escola" field="escola" /><EditField label="Série" field="serie" /><EditField label="Origem" field="origem_encaminhamento" />
                <EditField label="Resp. Técnico" field="responsavel_tecnico" /><EditField label="Vulnerabilidade" field="categoria_vulnerabilidade" /><EditField label="Início SCFV" field="iniciou_em" type="date" />
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Restrição Alimentar</Label><Textarea value={form.restricao_alimentar || ""} onChange={(e) => set("restricao_alimentar", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
                <div className="col-span-2 sm:col-span-3"><Label className="text-xs">Laudo</Label><Textarea value={form.laudo || ""} onChange={(e) => set("laudo", e.target.value)} className="text-sm mt-0.5 min-h-[50px]" /></div>
              </>
            ) : (
              <>
                <Info label="Origem" value={participante.origem_encaminhamento} /><Info label="Resp. Técnico" value={participante.responsavel_tecnico} />
                <Info label="Vulnerabilidade" value={participante.categoria_vulnerabilidade} /><Info label="Início SCFV" value={participante.iniciou_em} />
                <Info label="Restrição Alimentar" value={participante.restricao_alimentar} /><Info label="Laudo" value={participante.laudo} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ParticipantePerfilPage;
