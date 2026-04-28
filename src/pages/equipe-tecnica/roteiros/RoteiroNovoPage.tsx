import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Loader2, Save, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { displayAge } from "@/lib/constants";

type Part = {
  id: string; nome_completo: string; status: string; data_nascimento: string | null;
  endereco_rua: string | null; endereco_numero: string | null; endereco_bairro: string | null;
  responsavel1_whatsapp: string | null; responsavel1_nome: string | null; periodo: string | null;
};

export default function RoteiroNovoPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profis, setProfis] = useState<{ id: string; nome: string }[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [dataVisita, setDataVisita] = useState(format(new Date(), "yyyy-MM-dd"));
  const [horario, setHorario] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  const [filtro, setFiltro] = useState<"todos" | "busca_ativa" | "matricula">("todos");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [{ data: ps }, { data: pf }] = await Promise.all([
        supabase.from("participantes")
          .select("id, nome_completo, status, data_nascimento, endereco_rua, endereco_numero, endereco_bairro, responsavel1_whatsapp, responsavel1_nome, periodo")
          .in("status", ["busca_ativa", "pendente", "incompleto"])
          .order("endereco_bairro").order("nome_completo"),
        supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      setParts((ps ?? []) as Part[]);
      setProfis((pf ?? []) as any);
      if (user) {
        const { data: me } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
        if (me) { setMyProfileId(me.id); setResponsaveis([me.id]); }
      }
      setLoading(false);
    })();
  }, [user]);

  const partsFiltradas = useMemo(() => {
    return parts.filter(p => {
      if (filtro === "busca_ativa" && p.status !== "busca_ativa") return false;
      if (filtro === "matricula" && p.status === "busca_ativa") return false;
      if (busca && !p.nome_completo.toLowerCase().includes(busca.toLowerCase()) &&
          !(p.endereco_bairro ?? "").toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [parts, filtro, busca]);

  const porBairro = useMemo(() => {
    const m: Record<string, Part[]> = {};
    partsFiltradas.forEach(p => {
      const b = (p.endereco_bairro ?? "Sem bairro").trim() || "Sem bairro";
      if (!m[b]) m[b] = [];
      m[b].push(p);
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [partsFiltradas]);

  const toggle = (id: string) => {
    setSelecionados(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleBairro = (lista: Part[], all: boolean) => {
    setSelecionados(prev => {
      const n = new Set(prev);
      lista.forEach(p => { if (all) n.add(p.id); else n.delete(p.id); });
      return n;
    });
  };

  const salvar = async () => {
    if (!titulo.trim()) { toast.error("Informe o título"); return; }
    if (selecionados.size === 0) { toast.error("Selecione ao menos 1 participante"); return; }
    setSaving(true);
    try {
      const { data: roteiro, error } = await (supabase.from as any)("roteiros_visita").insert({
        titulo: titulo.trim(),
        data_visita: dataVisita,
        horario_saida: horario || null,
        veiculo: veiculo || null,
        observacoes: observacoes || null,
        responsaveis,
        criado_por: myProfileId,
        status: "rascunho",
      }).select("id").single();
      if (error) throw error;

      // Ordena selecionados: por bairro (alfabético), depois nome
      const ordenados = parts.filter(p => selecionados.has(p.id)).sort((a, b) => {
        const ba = (a.endereco_bairro ?? "").localeCompare(b.endereco_bairro ?? "");
        if (ba !== 0) return ba;
        return a.nome_completo.localeCompare(b.nome_completo);
      });

      const visitas = ordenados.map((p, idx) => ({
        roteiro_id: roteiro.id,
        participante_id: p.id,
        bairro_nome: p.endereco_bairro ?? null,
        origem: p.status === "busca_ativa" ? "busca_ativa" : "matricula_pendente",
        ordem: idx,
        status_visita: "pendente",
      }));

      const { error: e2 } = await (supabase.from as any)("roteiro_visitas").insert(visitas);
      if (e2) throw e2;

      toast.success("Roteiro criado!");
      nav(`/equipe-tecnica/roteiros/${roteiro.id}`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => nav("/equipe-tecnica")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl font-bold">Novo Roteiro de Visita</h1>
        </div>
        <Badge variant="outline">Etapa {step} de 2</Badge>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do roteiro</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Visitas BA Jardim Irene — semana 1" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={dataVisita} onChange={e => setDataVisita(e.target.value)} />
              </div>
              <div>
                <Label>Horário de saída</Label>
                <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
              </div>
              <div>
                <Label>Veículo</Label>
                <Input value={veiculo} onChange={e => setVeiculo(e.target.value)} placeholder="Ex: Carro institucional" />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Responsáveis</Label>
              <div className="border rounded-md p-2 max-h-44 overflow-y-auto space-y-1">
                {profis.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm hover:bg-accent rounded px-1 py-0.5 cursor-pointer">
                    <Checkbox
                      checked={responsaveis.includes(p.id)}
                      onCheckedChange={(c) => setResponsaveis(prev => c ? [...prev, p.id] : prev.filter(x => x !== p.id))}
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Selecionar visitas <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Selecionar participantes</CardTitle>
              <Badge>{selecionados.size} selecionado(s)</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filtro} onValueChange={(v: any) => setFiltro(v)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos (BA + Matrícula)</SelectItem>
                  <SelectItem value="busca_ativa">Apenas Busca Ativa</SelectItem>
                  <SelectItem value="matricula">Apenas Matrícula Pendente</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar nome ou bairro..." value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
            </div>

            {porBairro.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum participante encontrado.</p>
            )}

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {porBairro.map(([bairro, lista]) => {
                const allSel = lista.every(p => selecionados.has(p.id));
                return (
                  <div key={bairro} className="border rounded-md">
                    <div className="flex items-center justify-between bg-muted/40 p-2 border-b">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={allSel} onCheckedChange={(c) => toggleBairro(lista, !!c)} />
                        <span className="text-sm font-semibold">{bairro}</span>
                        <Badge variant="outline" className="text-[10px]">{lista.length}</Badge>
                      </div>
                    </div>
                    <div className="divide-y">
                      {lista.map(p => (
                        <label key={p.id} className="flex items-start gap-2 p-2 hover:bg-accent cursor-pointer">
                          <Checkbox checked={selecionados.has(p.id)} onCheckedChange={() => toggle(p.id)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{p.nome_completo}</span>
                              <Badge variant="outline" className={`text-[10px] ${p.status === "busca_ativa" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
                                {p.status === "busca_ativa" ? "Busca Ativa" : "Matrícula Nova"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {displayAge(p.data_nascimento)} • {p.endereco_rua ?? "—"}, {p.endereco_numero ?? "s/n"}
                              {p.responsavel1_whatsapp && ` • ${p.responsavel1_whatsapp}`}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button onClick={salvar} disabled={saving || selecionados.size === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Criar roteiro ({selecionados.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}