import { useState, useEffect } from "react";
import { ArrowLeft, Save, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { calcFaixaFromDate } from "@/lib/constants";
import { useIsDemo, guardDemo } from "@/hooks/useIsDemo";
import { maskCPF, maskPhone, unmaskDigits } from "@/lib/utils";
import ParticipanteIndividualCard, { emptyParticipante, type ParticipanteIndividual } from "./components/ParticipanteIndividualCard";

interface FamiliaData {
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  uf_origem: string;
  situacao_moradia: string;
  bairro_id: string;
  ponto_transporte_id: string;
  responsavel1_nome: string;
  responsavel1_whatsapp: string;
  vinculo_resp1: string;
  responsavel2_nome: string;
  responsavel2_whatsapp: string;
  vinculo_resp2: string;
  origem_encaminhamento: string;
  responsavel_tecnico: string;
  categoria_vulnerabilidade: string;
  restricao_alimentar: string;
}

const emptyFamilia = (): FamiliaData => ({
  endereco_rua: "", endereco_numero: "", endereco_bairro: "",
  uf_origem: "", situacao_moradia: "",
  bairro_id: "", ponto_transporte_id: "",
  responsavel1_nome: "", responsavel1_whatsapp: "", vinculo_resp1: "",
  responsavel2_nome: "", responsavel2_whatsapp: "", vinculo_resp2: "",
  origem_encaminhamento: "", responsavel_tecnico: "",
  categoria_vulnerabilidade: "", restricao_alimentar: "",
});

const ParticipanteNovoPage = () => {
  const navigate = useNavigate();
  const isDemo = useIsDemo();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [bairros, setBairros] = useState<Tables<"bairros">[]>([]);
  const [pontos, setPontos] = useState<Tables<"pontos_transporte">[]>([]);

  const [familia, setFamilia] = useState<FamiliaData>(emptyFamilia());
  const [participantes, setParticipantes] = useState<ParticipanteIndividual[]>([emptyParticipante()]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      supabase.from("bairros").select("*").order("nome"),
      supabase.from("pontos_transporte").select("*").order("nome"),
    ]).then(([{ data: b }, { data: p }]) => {
      setBairros(b || []);
      setPontos(p || []);
    });
  }, []);

  const setF = (field: keyof FamiliaData, value: string) => {
    setFamilia((prev) => {
      const next = { ...prev, [field]: value };
      // Propagar bairro/ponto para participantes que não personalizaram
      if (field === "bairro_id") {
        setParticipantes((arr) => arr.map(p => p._overridesBairro ? p : { ...p, bairro_id: value, ponto_transporte_id: p._overridesPonto ? p.ponto_transporte_id : "" }));
      } else if (field === "ponto_transporte_id") {
        setParticipantes((arr) => arr.map(p => p._overridesPonto ? p : { ...p, ponto_transporte_id: value }));
      }
      return next;
    });
  };

  const updateParticipante = (uid: string, patch: Partial<ParticipanteIndividual>) => {
    setParticipantes((arr) => arr.map(p => p.uid === uid ? { ...p, ...patch } : p));
  };

  const addParticipante = () => {
    const novo = emptyParticipante(familia.bairro_id, familia.ponto_transporte_id);
    setParticipantes((arr) => {
      // colapsar todos os anteriores
      const next: Record<string, boolean> = {};
      arr.forEach(p => { next[p.uid] = true; });
      setCollapsed(next);
      return [...arr, novo];
    });
  };

  const removeParticipante = (uid: string) => {
    setParticipantes((arr) => arr.length <= 1 ? arr : arr.filter(p => p.uid !== uid));
  };

  const toggleCollapse = (uid: string) => {
    setCollapsed((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  const salvarUm = async (p: ParticipanteIndividual): Promise<void> => {
    const payload: Record<string, unknown> = {
      nome_completo: p.nome_completo.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
      data_nascimento: p.data_nascimento || null,
      genero: p.genero || null,
      cor_raca: p.cor_raca || null,
      escola: p.escola || null,
      serie: p.serie || null,
      periodo: p.periodo,
      iniciou_em: p.iniciou_em || null,
      laudo: p.laudo || null,
      remedio_continuo: p.remedio_continuo || null,
      outras_condicoes: p.outras_condicoes || null,
      // Família (compartilhada)
      endereco_rua: familia.endereco_rua || null,
      endereco_numero: familia.endereco_numero || null,
      endereco_bairro: familia.endereco_bairro || null,
      uf_origem: familia.uf_origem || null,
      situacao_moradia: familia.situacao_moradia || null,
      responsavel1_nome: familia.responsavel1_nome || null,
      responsavel1_whatsapp: familia.responsavel1_whatsapp || null,
      vinculo_resp1: familia.vinculo_resp1 || null,
      responsavel2_nome: familia.responsavel2_nome || null,
      responsavel2_whatsapp: familia.responsavel2_whatsapp || null,
      vinculo_resp2: familia.vinculo_resp2 || null,
      origem_encaminhamento: familia.origem_encaminhamento || null,
      responsavel_tecnico: familia.responsavel_tecnico || null,
      categoria_vulnerabilidade: familia.categoria_vulnerabilidade || null,
      restricao_alimentar: familia.restricao_alimentar || null,
    };
    if (p.cpf) payload.cpf = p.cpf;
    if (p.bairro_id) payload.bairro_id = p.bairro_id;
    if (p.ponto_transporte_id) payload.ponto_transporte_id = p.ponto_transporte_id;
    // remover null que campo não aceite
    Object.keys(payload).forEach(k => { if (payload[k] === null) delete payload[k]; });

    if (p.fotoFile) {
      const ext = p.fotoFile.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos-participantes").upload(path, p.fotoFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("fotos-participantes").getPublicUrl(path);
        payload.foto_url = urlData.publicUrl;
      }
    }

    const { data: inserted, error } = await supabase.from("participantes").insert(payload as any).select().single();
    if (error) throw error;

    if (inserted && p.pendingDocs.length > 0) {
      for (const doc of p.pendingDocs) {
        const storagePath = `${inserted.id}/${doc.fileName}`;
        const { error: upErr } = await supabase.storage.from("documentos").upload(storagePath, doc.blob, { contentType: "application/pdf" });
        if (!upErr) {
          await supabase.from("participante_documentos" as any).insert({
            participante_id: inserted.id,
            categoria: doc.categoria,
            nome_arquivo: doc.fileName,
            arquivo_url: storagePath,
          });
        }
      }
    }

    if (inserted && (inserted.status === "ativo" || !inserted.status)) {
      try {
        const faixa = calcFaixaFromDate(inserted.data_nascimento);
        if (inserted.bairro_id && inserted.periodo && faixa) {
          let query = supabase.from("turmas").select("id")
            .eq("ativa", true)
            .eq("bairro_id", inserted.bairro_id)
            .eq("faixa_etaria", faixa as any);
          if (inserted.periodo !== "integral") {
            query = query.eq("periodo", inserted.periodo as any);
          }
          const { data: turmasCompativeis } = await query;
          if (turmasCompativeis && turmasCompativeis.length > 0) {
            const links = turmasCompativeis.map(t => ({ turma_id: t.id, participante_id: inserted.id }));
            await supabase.from("turma_participantes").insert(links);
          }
        }
      } catch { /* ignore */ }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardDemo(isDemo)) return;

    // Validação
    for (let i = 0; i < participantes.length; i++) {
      const p = participantes[i];
      if (!p.nome_completo.trim()) {
        toast.error(`Participante ${i + 1}: nome é obrigatório`);
        setCollapsed((prev) => ({ ...prev, [p.uid]: false }));
        return;
      }
      if (!p.iniciou_em) {
        toast.error(`Participante ${i + 1}: data de início no SCFV é obrigatória`);
        setCollapsed((prev) => ({ ...prev, [p.uid]: false }));
        return;
      }
    }

    setSaving(true);
    setProgress({ current: 0, total: participantes.length });

    const sucessos: string[] = [];
    const falhas: ParticipanteIndividual[] = [];

    for (let i = 0; i < participantes.length; i++) {
      const p = participantes[i];
      setProgress({ current: i + 1, total: participantes.length });
      try {
        await salvarUm(p);
        sucessos.push(p.nome_completo);
      } catch (err: any) {
        falhas.push(p);
        toast.error(`Erro ao salvar ${p.nome_completo}: ${err.message}`);
      }
    }

    setSaving(false);
    setProgress(null);

    if (falhas.length === 0) {
      toast.success(participantes.length === 1 ? "Participante cadastrado!" : `${sucessos.length} participantes cadastrados!`);
      navigate("/participantes");
    } else if (sucessos.length > 0) {
      toast.warning(`${sucessos.length} salvo(s), ${falhas.length} com erro. Tente novamente.`);
      setParticipantes(falhas);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/participantes"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-xl font-semibold text-foreground">Novo Participante</h1>
        {participantes.length > 1 && <span className="text-xs text-muted-foreground">({participantes.length} fichas)</span>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Família — Endereço */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Endereço (compartilhado pela família)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Rua</Label>
              <Input value={familia.endereco_rua} onChange={(e) => setF("endereco_rua", e.target.value)} placeholder="Nome da rua" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Número</Label>
              <Input value={familia.endereco_numero} onChange={(e) => setF("endereco_numero", e.target.value)} placeholder="Nº" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Bairro (texto)</Label>
              <Input value={familia.endereco_bairro} onChange={(e) => setF("endereco_bairro", e.target.value)} placeholder="Bairro" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">UF de Origem</Label>
              <Input value={familia.uf_origem} onChange={(e) => setF("uf_origem", e.target.value)} placeholder="Ex: PR" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Situação de Moradia</Label>
              <Input value={familia.situacao_moradia} onChange={(e) => setF("situacao_moradia", e.target.value)} placeholder="Própria, alugada..." className="h-9 text-sm mt-1" />
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground">Bairro do CAIA e ponto de transporte são definidos individualmente em cada ficha (com herança automática se não personalizados).</p>
          </CardContent>
        </Card>

        {/* Família — Responsáveis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Responsáveis (compartilhados)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-medium">Responsável 1 - Nome</Label>
              <Input value={familia.responsavel1_nome} onChange={(e) => setF("responsavel1_nome", e.target.value)} placeholder="Nome completo" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Vínculo</Label>
              <Input value={familia.vinculo_resp1} onChange={(e) => setF("vinculo_resp1", e.target.value)} placeholder="Ex: Mãe, Pai, Avó" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">WhatsApp</Label>
              <Input value={maskPhone(familia.responsavel1_whatsapp)} onChange={(e) => setF("responsavel1_whatsapp", unmaskDigits(e.target.value))} placeholder="(00) 00000-0000" className="h-9 text-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Responsável 2 - Nome</Label>
              <Input value={familia.responsavel2_nome} onChange={(e) => setF("responsavel2_nome", e.target.value)} placeholder="Nome completo" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Vínculo</Label>
              <Input value={familia.vinculo_resp2} onChange={(e) => setF("vinculo_resp2", e.target.value)} placeholder="Ex: Mãe, Pai, Avó" className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">WhatsApp</Label>
              <Input value={maskPhone(familia.responsavel2_whatsapp)} onChange={(e) => setF("responsavel2_whatsapp", unmaskDigits(e.target.value))} placeholder="(00) 00000-0000" className="h-9 text-sm mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Família — Complementares */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Informações Familiares</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium">Origem/Encaminhamento</Label>
              <Input value={familia.origem_encaminhamento} onChange={(e) => setF("origem_encaminhamento", e.target.value)} placeholder="CRAS, escola..." className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Responsável Técnico</Label>
              <Input value={familia.responsavel_tecnico} onChange={(e) => setF("responsavel_tecnico", e.target.value)} placeholder="Nome do técnico" className="h-9 text-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Categoria de Vulnerabilidade</Label>
              <div className="mt-1">
                <CategoriaVulnerabilidadeCombobox
                  value={familia.categoria_vulnerabilidade}
                  onChange={(v) => setF("categoria_vulnerabilidade", v)}
                />
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Restrição Alimentar (familiar)</Label>
              <Textarea value={familia.restricao_alimentar} onChange={(e) => setF("restricao_alimentar", e.target.value)} placeholder="Alergias, intolerâncias..." className="text-sm mt-1 min-h-[50px]" />
            </div>
          </CardContent>
        </Card>

        {/* Bairro CAIA / Ponto compartilhado (editável por ficha) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Bairro do CAIA padrão (opcional)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-2">Define o bairro/ponto inicial que será aplicado automaticamente a cada ficha de participante. Cada ficha pode personalizar.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Bairro do CAIA</Label>
                <select
                  value={familia.bairro_id}
                  onChange={(e) => setF("bairro_id", e.target.value)}
                  className="h-9 w-full text-sm mt-1 rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {bairros.filter(b => /JARDIM IRENE|PARQUE INDEPEND|ALVORADA/i.test(b.nome)).map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium">Ponto de Transporte</Label>
                <select
                  value={familia.ponto_transporte_id}
                  onChange={(e) => setF("ponto_transporte_id", e.target.value)}
                  className="h-9 w-full text-sm mt-1 rounded-md border border-input bg-background px-3"
                >
                  <option value="">Selecionar</option>
                  {pontos.filter(p => !familia.bairro_id || p.bairro_id === familia.bairro_id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de participantes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Participantes ({participantes.length})</h2>
          </div>
          {participantes.map((p, idx) => (
            <ParticipanteIndividualCard
              key={p.uid}
              index={idx}
              data={p}
              bairros={bairros}
              pontos={pontos}
              canRemove={participantes.length > 1}
              collapsed={!!collapsed[p.uid]}
              onToggleCollapse={() => toggleCollapse(p.uid)}
              onChange={(patch) => updateParticipante(p.uid, patch)}
              onRemove={() => removeParticipante(p.uid)}
            />
          ))}
          <Button type="button" variant="outline" onClick={addParticipante} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" />Adicionar outro participante (irmão)
          </Button>
        </div>

        <div className="flex justify-end items-center gap-3 pt-2">
          {progress && (
            <span className="text-xs text-muted-foreground">Salvando {progress.current} de {progress.total}...</span>
          )}
          <Button type="button" variant="outline" asChild><Link to="/participantes">Cancelar</Link></Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Salvando..." : participantes.length === 1 ? "Salvar" : `Salvar ${participantes.length} participantes`}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ParticipanteNovoPage;
