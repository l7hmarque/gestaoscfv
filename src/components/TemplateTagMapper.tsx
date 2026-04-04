import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PizZip from "pizzip";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Available system fields per template type
const SYSTEM_FIELDS: Record<string, { value: string; label: string }[]> = {
  "relatorio.docx": [
    { value: "data", label: "Data da atividade" },
    { value: "dia_semana", label: "Dia da semana" },
    { value: "profiles.nome", label: "Educador (nome)" },
    { value: "turmas", label: "Turmas" },
    { value: "tipo_atividade", label: "Tipo de atividade" },
    { value: "nome_atividade", label: "Nome da atividade" },
    { value: "score_elo", label: "Score ELO" },
    { value: "iniciativa", label: "Iniciativa (1-5)" },
    { value: "iniciativa_label", label: "Iniciativa (texto)" },
    { value: "autonomia", label: "Autonomia (1-5)" },
    { value: "autonomia_label", label: "Autonomia (texto)" },
    { value: "colaboracao", label: "Colaboração (1-5)" },
    { value: "colaboracao_label", label: "Colaboração (texto)" },
    { value: "comunicacao", label: "Comunicação (1-5)" },
    { value: "comunicacao_label", label: "Comunicação (texto)" },
    { value: "respeito_mutuo", label: "Respeito mútuo (1-5)" },
    { value: "respeito_mutuo_label", label: "Respeito mútuo (texto)" },
    { value: "pct_adesao", label: "% Adesão" },
    { value: "num_participantes", label: "Nº Presentes" },
    { value: "num_ausentes", label: "Nº Ausentes" },
    { value: "num_matriculados", label: "Nº Matriculados" },
    { value: "objetivo_alcancado", label: "Objetivo alcançado" },
    { value: "intervencoes", label: "Intervenções" },
    { value: "observacoes", label: "Observações" },
    { value: "eng_1", label: "Engajamento: Grupo participativo" },
    { value: "eng_2", label: "Engajamento: Grupo disperso" },
    { value: "eng_3", label: "Engajamento: Boa interação entre participantes" },
    { value: "eng_4", label: "Engajamento: Necessitou intervenção do educador" },
    { value: "sit_1", label: "Situação: Nenhuma ocorrência" },
    { value: "sit_2", label: "Situação: Conflito entre participantes" },
    { value: "sit_3", label: "Situação: Situação de vulnerabilidade identificada" },
    { value: "sit_4", label: "Situação: Encaminhamento necessário" },
    { value: "sit_5", label: "Situação: Comunicação com família/responsável" },
    { value: "obj_1", label: "Objetivo: Alcançado" },
    { value: "obj_2", label: "Objetivo: Parcialmente alcançado" },
    { value: "obj_3", label: "Objetivo: Não alcançado" },
    { value: "presenca_loop", label: "Lista de presença (loop)" },
    { value: "analise_ia", label: "Análise IA" },
    { value: "fotos", label: "Fotos (imagens embutidas)" },
    { value: "nome_grupo", label: "Nome do grupo (turma)" },
    { value: "periodo_scfv", label: "Período SCFV (inverso)" },
  ],
  "planejamento.docx": [
    { value: "titulo", label: "Título" },
    { value: "data_aplicacao", label: "Data de aplicação" },
    { value: "profiles.nome", label: "Educador (nome)" },
    { value: "turmas", label: "Turmas" },
    { value: "tema", label: "Tema" },
    { value: "questao_geradora", label: "Questão geradora" },
    { value: "objetivos", label: "Objetivos" },
    { value: "roteiro", label: "Roteiro" },
    { value: "materiais", label: "Materiais" },
    { value: "apoio_tecnico", label: "Apoio técnico" },
    { value: "forma_avaliacao", label: "Forma de avaliação" },
  ],
  "ficha_inscricao.docx": [
    { value: "nome_completo", label: "Nome completo" },
    { value: "data_nascimento", label: "Data de nascimento" },
    { value: "genero", label: "Gênero" },
    { value: "cor_raca", label: "Cor/Raça" },
    { value: "escola", label: "Escola" },
    { value: "serie", label: "Série" },
    { value: "periodo", label: "Período" },
    { value: "responsavel1_nome", label: "Responsável 1 - Nome" },
    { value: "cpf", label: "CPF do participante" },
    { value: "responsavel1_whatsapp", label: "Responsável 1 - WhatsApp" },
    { value: "vinculo_resp1", label: "Vínculo Resp. 1 (parentesco)" },
    { value: "responsavel2_nome", label: "Responsável 2 - Nome" },
    { value: "responsavel2_whatsapp", label: "Responsável 2 - WhatsApp" },
    { value: "vinculo_resp2", label: "Vínculo Resp. 2 (parentesco)" },
    { value: "endereco_rua", label: "Endereço - Rua" },
    { value: "endereco_numero", label: "Endereço - Número" },
    { value: "endereco_bairro", label: "Endereço - Bairro" },
    { value: "bairro_scfv", label: "Bairro SCFV" },
    { value: "uf_origem", label: "UF de origem" },
    { value: "situacao_moradia", label: "Situação de moradia" },
    { value: "laudo", label: "Laudo" },
    { value: "restricao_alimentar", label: "Restrição alimentar" },
    { value: "remedio_continuo", label: "Remédio de uso contínuo" },
    { value: "outras_condicoes", label: "Outras condições de saúde" },
    { value: "categoria_vulnerabilidade", label: "Categoria de vulnerabilidade" },
    { value: "origem_encaminhamento", label: "Origem/Encaminhamento" },
    { value: "responsavel_tecnico", label: "Responsável técnico" },
    { value: "status", label: "Status" },
    { value: "iniciou_em", label: "Iniciou em" },
    { value: "foto_url", label: "URL da foto" },
    { value: "data_desligamento", label: "Data de desligamento" },
    { value: "dias_contraturno", label: "Dias de contraturno" },
    { value: "turmas", label: "Turmas vinculadas" },
    { value: "documentos", label: "Documentos anexos (lista)" },
    { value: "ponto_transporte", label: "Ponto de transporte" },
    { value: "periodo_scfv", label: "Período SCFV (inverso)" },
    { value: "nome_grupo", label: "Nome do grupo (turma)" },
    { value: "justificativa_desligamento", label: "Justificativa de desligamento" },
    { value: "motivo_desligamento", label: "Motivo de desligamento" },
  ],
  "matriz_frequencia.docx": [
    { value: "turma_nome", label: "Nome da turma" },
    { value: "periodo", label: "Período" },
    { value: "faixa_etaria", label: "Faixa etária" },
    { value: "mes_ano", label: "Mês/Ano" },
    { value: "participantes_loop", label: "Participantes (loop)" },
    { value: "datas_loop", label: "Datas de atividade (loop)" },
  ],
};

// Auto-match heuristics
const AUTO_MATCH: Record<string, string> = {
  // Relatório
  DATA: "data", DATA_ATIVIDADE: "data", DIA: "dia_semana", DIA_SEMANA: "dia_semana",
  EDUCADOR: "profiles.nome", NOME_EDUCADOR: "profiles.nome",
  TURMAS: "turmas", TURMA: "turmas",
  TIPO: "tipo_atividade", TIPO_ATIVIDADE: "tipo_atividade",
  ATIVIDADE: "nome_atividade", NOME_ATIVIDADE: "nome_atividade",
  SCORE: "score_elo", SCORE_ELO: "score_elo", ELO: "score_elo",
  INICIATIVA: "iniciativa", AUTONOMIA: "autonomia", COLABORACAO: "colaboracao",
  COMUNICACAO: "comunicacao", RESPEITO: "respeito_mutuo", RESPEITO_MUTUO: "respeito_mutuo",
  INICIATIVA_LABEL: "iniciativa_label", AUTONOMIA_LABEL: "autonomia_label",
  COLABORACAO_LABEL: "colaboracao_label", COMUNICACAO_LABEL: "comunicacao_label",
  RESPEITO_MUTUO_LABEL: "respeito_mutuo_label",
  ADESAO: "pct_adesao", PCT_ADESAO: "pct_adesao",
  PRESENTES: "num_participantes", NUM_PRESENTES: "num_participantes",
  AUSENTES: "num_ausentes", NUM_AUSENTES: "num_ausentes",
  MATRICULADOS: "num_matriculados", NUM_MATRICULADOS: "num_matriculados",
  OBJETIVO: "objetivo_alcancado", OBJETIVO_ALCANCADO: "objetivo_alcancado",
  INTERVENCOES: "intervencoes", OBSERVACOES: "observacoes",
  ANALISE: "analise_ia", ANALISE_IA: "analise_ia",
  // Engajamento/Situações
  ENG_1: "eng_1", ENG_2: "eng_2", ENG_3: "eng_3", ENG_4: "eng_4",
  SIT_1: "sit_1", SIT_2: "sit_2", SIT_3: "sit_3", SIT_4: "sit_4", SIT_5: "sit_5",
  OBJ_1: "obj_1", OBJ_2: "obj_2", OBJ_3: "obj_3",
  NOME_GRUPO: "nome_grupo", PERIODO_SCFV: "periodo_scfv",
  PONTO_TRANSPORTE: "ponto_transporte",
  // Desligamento (both variants)
  JUST_DESLG: "justificativa_desligamento", JUST_DESLIG: "justificativa_desligamento",
  MOTIVO_DESLG: "motivo_desligamento", MOTIVO_DESLIG: "motivo_desligamento",
  // Planejamento
  TITULO: "titulo", TEMA: "tema", QUESTAO: "questao_geradora", QUESTAO_GERADORA: "questao_geradora",
  OBJETIVOS: "objetivos", ROTEIRO: "roteiro", MATERIAIS: "materiais",
  APOIO: "apoio_tecnico", APOIO_TECNICO: "apoio_tecnico",
  AVALIACAO: "forma_avaliacao", FORMA_AVALIACAO: "forma_avaliacao",
  DATA_APLICACAO: "data_aplicacao",
  // Ficha
  NOME: "nome_completo", NOME_COMPLETO: "nome_completo",
  NASCIMENTO: "data_nascimento", DATA_NASCIMENTO: "data_nascimento",
  GENERO: "genero", COR_RACA: "cor_raca", COR: "cor_raca",
  ESCOLA: "escola", SERIE: "serie", PERIODO: "periodo",
  RESPONSAVEL1: "responsavel1_nome", RESPONSAVEL1_NOME: "responsavel1_nome",
  CPF: "cpf", RESPONSAVEL1_WHATSAPP: "responsavel1_whatsapp",
  RESPONSAVEL2: "responsavel2_nome", RESPONSAVEL2_NOME: "responsavel2_nome",
  RESPONSAVEL2_WHATSAPP: "responsavel2_whatsapp",
  // Vínculos e saúde (novas tags)
  VINCULO_RESP1: "vinculo_resp1", VINCULO_RESP2: "vinculo_resp2",
  REMEDIO: "remedio_continuo", REMEDIO_CONTINUO: "remedio_continuo",
  OUTRAS_COND: "outras_condicoes", OUTRAS_CONDICOES: "outras_condicoes",
  // Lowercase variants from templates
  nomegrupo: "nome_grupo", responsavel2: "responsavel2_nome", outras_cond: "outras_condicoes",
  // Endereço
  RUA: "endereco_rua", ENDERECO_RUA: "endereco_rua",
  NUMERO: "endereco_numero", ENDERECO_NUMERO: "endereco_numero",
  BAIRRO: "endereco_bairro", ENDERECO_BAIRRO: "endereco_bairro",
  BAIRRO_SCFV: "bairro_scfv", UF: "uf_origem", UF_ORIGEM: "uf_origem",
  MORADIA: "situacao_moradia", SITUACAO_MORADIA: "situacao_moradia",
  LAUDO: "laudo", RESTRICAO: "restricao_alimentar", RESTRICAO_ALIMENTAR: "restricao_alimentar",
  VULNERABILIDADE: "categoria_vulnerabilidade", CATEGORIA_VULNERABILIDADE: "categoria_vulnerabilidade",
  ENCAMINHAMENTO: "origem_encaminhamento", ORIGEM_ENCAMINHAMENTO: "origem_encaminhamento",
  RESPONSAVEL_TECNICO: "responsavel_tecnico", STATUS: "status",
  INICIOU: "iniciou_em", INICIOU_EM: "iniciou_em", FOTO: "foto_url", FOTO_URL: "foto_url",
  DESLIGAMENTO: "data_desligamento", DATA_DESLIGAMENTO: "data_desligamento",
  CONTRATURNO: "dias_contraturno", DIAS_CONTRATURNO: "dias_contraturno",
  DOCUMENTOS: "documentos", TURMAS_VINCULADAS: "turmas",
  // Matriz
  TURMA_NOME: "turma_nome", MES_ANO: "mes_ano", FAIXA_ETARIA: "faixa_etaria",
};

interface TemplateTagMapperProps {
  templateKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function extractTagsFromDocx(templateKey: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage.from("templates").download(templateKey);
    if (error || !data) throw new Error(error?.message || "Download failed");
    const buffer = await data.arrayBuffer();
    const zip = new PizZip(buffer);
    const tags = new Set<string>();
    for (const fileName of Object.keys(zip.files)) {
      if (!fileName.endsWith(".xml") && !fileName.endsWith(".rels")) continue;
      const content = zip.file(fileName)?.asText() || "";
      // Strip XML tags to get just text, then find {TAG} patterns
      const cleaned = content.replace(/<[^>]+>/g, "");
      const matches = cleaned.matchAll(/\{([A-Za-z0-9_]+)\}/g);
      for (const m of matches) tags.add(m[1]);
    }
    return Array.from(tags).sort();
  } catch (e: any) {
    console.error("Error extracting tags:", e);
    return [];
  }
}

export default function TemplateTagMapper({ templateKey, open, onOpenChange }: TemplateTagMapperProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});

  const fields = SYSTEM_FIELDS[templateKey] || [];

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open, templateKey]);

  const loadData = async () => {
    setLoading(true);
    // Load tags from DOCX and existing mappings in parallel
    const [extractedTags, { data: existingMappings }] = await Promise.all([
      extractTagsFromDocx(templateKey),
      supabase
        .from("template_tag_mappings")
        .select("tag_name, data_field")
        .eq("template_key", templateKey),
    ]);

    setTags(extractedTags);

    // Build mappings: existing DB mappings first, then auto-match for unmapped
    const map: Record<string, string> = {};
    const dbMap: Record<string, string> = {};
    existingMappings?.forEach((m: any) => { dbMap[m.tag_name] = m.data_field; });

    for (const tag of extractedTags) {
      if (dbMap[tag]) {
        map[tag] = dbMap[tag];
      } else if (AUTO_MATCH[tag]) {
        map[tag] = AUTO_MATCH[tag];
      }
    }
    setMappings(map);
    setLoading(false);
  };

  const handleAutoMatch = () => {
    const updated = { ...mappings };
    for (const tag of tags) {
      if (!updated[tag] && AUTO_MATCH[tag]) {
        updated[tag] = AUTO_MATCH[tag];
      }
    }
    setMappings(updated);
    toast.success("Auto-match aplicado");
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete existing and insert all
    await supabase
      .from("template_tag_mappings")
      .delete()
      .eq("template_key", templateKey);

    const rows = Object.entries(mappings)
      .filter(([, v]) => v && v !== "__none__")
      .map(([tag_name, data_field]) => ({
        template_key: templateKey,
        tag_name,
        data_field,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from("template_tag_mappings").insert(rows);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        setSaving(false);
        return;
      }
    }
    toast.success(`${rows.length} mapeamentos salvos`);
    setSaving(false);
    onOpenChange(false);
  };

  const mappedCount = Object.values(mappings).filter(v => v && v !== "__none__").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base">
            Mapear Tags — {templateKey}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {tags.length} tags encontradas · {mappedCount} mapeadas
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Extraindo tags do template...</span>
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma tag {"{TAG}"} encontrada no template.
          </p>
        ) : (
          <ScrollArea className="flex-1 min-h-0 pr-2">
            <div className="space-y-2">
              {tags.map(tag => (
                <div key={tag} className="flex items-center gap-3 p-2 rounded-md border border-border bg-muted/20">
                  <Badge variant="outline" className="text-xs font-mono shrink-0 min-w-[120px] justify-center">
                    {`{${tag}}`}
                  </Badge>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Select
                    value={mappings[tag] || "__none__"}
                    onValueChange={(val) => setMappings(prev => ({ ...prev, [tag]: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Selecionar campo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Não mapear —</SelectItem>
                      {fields.map(f => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={loading || tags.length === 0}>
            <Wand2 className="h-4 w-4 mr-1" /> Auto-match
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading || saving || tags.length === 0}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar Mapeamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export for use in useDocumentExport
export { SYSTEM_FIELDS, AUTO_MATCH, extractTagsFromDocx };
