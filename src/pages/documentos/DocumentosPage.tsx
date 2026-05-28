import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import {
  FolderDown, ClipboardCheck, FileText, BarChart3, Shield, HeartHandshake,
  ExternalLink, Play, Lock, Info,
} from "lucide-react";
import { useCapabilities } from "@/hooks/useCapabilities";

// Reusa os 7 diálogos oficiais já existentes
import FichaReferenciamentoDialog from "../relatorios/oficiais/FichaReferenciamentoDialog";
import FaltasConsecutivasDialog from "../relatorios/oficiais/FaltasConsecutivasDialog";
import CoberturaPrioritariaDialog from "../relatorios/oficiais/CoberturaPrioritariaDialog";
import EvasaoDialog from "../relatorios/oficiais/EvasaoDialog";
import EncaminhamentosDialog from "../relatorios/oficiais/EncaminhamentosDialog";
import BoletimArticulacaoDialog from "../relatorios/oficiais/BoletimArticulacaoDialog";
import BoletimPedagogicoDialog from "../relatorios/oficiais/BoletimPedagogicoDialog";

// Embute os fluxos pesados (lazy import para não pesar a primeira carga)
import { lazy, Suspense } from "react";
const PresencaExportarPage = lazy(() => import("../presenca/PresencaExportarPage"));
const ExportarRelatoriosPage = lazy(() => import("../relatorios/ExportarRelatoriosPage"));
const DashboardRelatorioMensalTab = lazy(() => import("../dashboard/DashboardRelatorioMensalTab"));

type CardSpec = {
  titulo: string;
  descricao: string;
  destinatario: string;
  formato?: string;
  conteudo?: string[];
  to?: string;
  action?: () => void;
  actionLabel?: string;
  disabled?: boolean;
};

function DocumentCard({ c }: { c: CardSpec }) {
  return (
    <Card className="border-border/60 hover:border-primary/40 transition-colors h-full">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight flex-1">{c.titulo}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">{c.destinatario}</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{c.descricao}</p>
        {c.conteudo && c.conteudo.length > 0 && (
          <div className="border-t border-border/60 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">O que traz</p>
            <ul className="text-[11px] text-foreground/80 space-y-0.5 list-disc pl-4">
              {c.conteudo.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        )}
        {c.formato && (
          <p className="text-[10px] text-muted-foreground">
            <span className="font-semibold">Formato:</span> {c.formato}
          </p>
        )}
        <div className="pt-1">
          {c.disabled ? (
            <Button size="sm" disabled variant="outline" className="w-full h-8">
              <Lock className="h-3.5 w-3.5 mr-1" /> Sem permissão
            </Button>
          ) : c.action ? (
            <Button size="sm" className="w-full h-8" onClick={c.action}>
              <Play className="h-3.5 w-3.5 mr-1" /> {c.actionLabel || "Gerar agora"}
            </Button>
          ) : c.to ? (
            <Button asChild size="sm" variant="outline" className="w-full h-8">
              <Link to={c.to}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ items }: { items: CardSpec[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
      {items.map((c) => <DocumentCard key={c.titulo} c={c} />)}
    </div>
  );
}

function EmbeddedFlow({ children, intro }: { children: React.ReactNode; intro?: React.ReactNode }) {
  return (
    <div className="mt-4 space-y-4">
      {intro && (
        <Card className="border-l-4 border-l-primary/60 bg-muted/30">
          <CardContent className="p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <div>{intro}</div>
          </CardContent>
        </Card>
      )}
      <Suspense fallback={<div className="text-xs text-muted-foreground py-6">Carregando...</div>}>
        {children}
      </Suspense>
    </div>
  );
}

export default function DocumentosPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "presenca";
  const [tab, setTab] = useState(initialTab);
  const { can, isSuperAdmin } = useCapabilities();
  const canGestao = isSuperAdmin || can("coordenacao", "read");

  useEffect(() => {
    if (tab !== searchParams.get("tab")) {
      setSearchParams((sp) => { sp.set("tab", tab); return sp; });
    }
  }, [tab]);

  // Dialogs oficiais
  const [openFicha, setOpenFicha] = useState(false);
  const [openFaltas, setOpenFaltas] = useState(false);
  const [openCobertura, setOpenCobertura] = useState(false);
  const [openEvasao, setOpenEvasao] = useState(false);
  const [openEncs, setOpenEncs] = useState(false);
  const [openBoletim, setOpenBoletim] = useState(false);
  const [openBoletimPed, setOpenBoletimPed] = useState(false);

  // Sub-tabs Gestão
  const [gestaoSub, setGestaoSub] = useState("mensal");

  // Sub-tabs Atividades
  const [atividadesSub, setAtividadesSub] = useState("lote");

  const oficiais: CardSpec[] = [
    {
      titulo: "Ficha de Referenciamento",
      descricao: "Documento individual para encaminhamento à rede de proteção.",
      destinatario: "CRAS · CREAS · CT · MP",
      formato: "PDF",
      conteudo: ["Identificação completa do participante", "Vínculo familiar e responsáveis", "Frequência consolidada", "Histórico de busca ativa"],
      action: () => setOpenFicha(true), actionLabel: "Selecionar participante",
    },
    {
      titulo: "Faltas Consecutivas com Alerta",
      descricao: "Identifica participantes com faltas seguidas acima do limite.",
      destinatario: "Conselho Tutelar · Coord.",
      formato: "PDF",
      conteudo: ["Lista de participantes com N+ faltas seguidas", "Sugestão de encaminhamento", "Contatos da família"],
      action: () => setOpenFaltas(true),
    },
    {
      titulo: "Cobertura de Público Prioritário",
      descricao: "Cruza metas territoriais com atendidos por categoria de vulnerabilidade.",
      destinatario: "SAS · Controladoria · MP",
      formato: "XLSX",
      conteudo: ["Metas vs realizado por bairro", "Categorias PBF / BPC / ECA", "Defasagem percentual"],
      action: () => setOpenCobertura(true),
    },
    {
      titulo: "Relatório de Evasão",
      descricao: "Desligamentos do período com motivo e histórico.",
      destinatario: "SAS · CRAS · Coord.",
      formato: "PDF",
      conteudo: ["Motivos de desligamento", "Tempo de permanência", "Tentativas de busca ativa registradas"],
      action: () => setOpenEvasao(true),
    },
    {
      titulo: "Encaminhamentos por Órgão",
      descricao: "Resumo e detalhamento por órgão receptor.",
      destinatario: "Rede · MP",
      formato: "PDF",
      conteudo: ["Lista por CRAS, CREAS, CT, UBS, MP", "Status e datas de retorno", "Observações de devolutiva"],
      action: () => setOpenEncs(true),
    },
    {
      titulo: "Boletim de Articulação com a Rede",
      descricao: "Consolidado mensal de articulação com a rede de proteção.",
      destinatario: "SAS · Controladoria",
      formato: "PDF",
      conteudo: ["Atendidos do mês", "Ingressos e desligamentos", "Busca ativa e encaminhamentos"],
      action: () => setOpenBoletim(true),
    },
    {
      titulo: "Boletim Pedagógico Individual",
      descricao: "Evolução do participante para a família e rede.",
      destinatario: "Família · Rede",
      formato: "PDF",
      conteudo: ["Frequência mês a mês", "Atividades desenvolvidas", "Relatos da equipe técnica", "Encaminhamentos ativos"],
      action: () => setOpenBoletimPed(true), actionLabel: "Selecionar participante",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FolderDown className="h-5 w-5" />}
        title="Documentos & Relatórios"
        subtitle="Central única de geração e exportação de documentos. Cada documento informa o que traz, para quem se destina e em que formato."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="presenca" className="gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> Presença</TabsTrigger>
          <TabsTrigger value="atividades" className="gap-1"><FileText className="h-3.5 w-3.5" /> Atividades</TabsTrigger>
          <TabsTrigger value="gestao" className="gap-1" disabled={!canGestao}>
            <BarChart3 className="h-3.5 w-3.5" /> Gestão {!canGestao && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="oficiais" className="gap-1">
            <Shield className="h-3.5 w-3.5" /> Oficiais / Rede
            <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-1">NOVO</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presenca">
          <EmbeddedFlow
            intro={<>
              <strong className="text-foreground">Listas de Presença e Frequência mensais.</strong> Geração via Google Drive (Sheets) com uma aba por turma.
              Para correções pontuais de presença diária, use a página <Link to="/presenca" className="text-primary underline">Presença</Link>.
            </>}
          >
            <PresencaExportarPage />
          </EmbeddedFlow>
        </TabsContent>

        <TabsContent value="atividades">
          <EmbeddedFlow
            intro={<>
              <strong className="text-foreground">Relatórios pedagógicos e planejamentos institucionais.</strong> Aqui você gera relatórios de atividade em lote, planejamentos consolidados e atalhos para o catálogo completo.
            </>}
          >
            <Tabs value={atividadesSub} onValueChange={setAtividadesSub}>
              <TabsList>
                <TabsTrigger value="lote">Exportação em Lote</TabsTrigger>
                <TabsTrigger value="atalhos">Atalhos</TabsTrigger>
              </TabsList>
              <TabsContent value="lote" className="mt-3">
                <ExportarRelatoriosPage />
              </TabsContent>
              <TabsContent value="atalhos" className="mt-3">
                <Section items={[
                  {
                    titulo: "Catálogo de Relatórios de Atividade",
                    descricao: "Lista completa de relatórios pedagógicos com filtros, ranking ELO e edição.",
                    destinatario: "Interno", formato: "Web",
                    conteudo: ["Filtros por turma, educador e período", "Score ELO consolidado", "Edição e ressincronização"],
                    to: "/relatorios",
                  },
                  {
                    titulo: "Planejamentos Institucionais",
                    descricao: "Banco de planejamentos validados pela Coordenação.",
                    destinatario: "Interno", formato: "Web",
                    conteudo: ["Estrutura rigorosa por eixo", "Formas de avaliação", "Aprovações registradas"],
                    to: "/planejamentos",
                  },
                ]} />
              </TabsContent>
            </Tabs>
          </EmbeddedFlow>
        </TabsContent>

        <TabsContent value="gestao">
          {!canGestao ? (
            <Card className="mt-4">
              <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-destructive" />
                Esta aba é restrita a perfis de Coordenação e Super Administração.
              </CardContent>
            </Card>
          ) : (
            <EmbeddedFlow
              intro={<>
                <strong className="text-foreground">Relatórios administrativos e técnicos para governo, MP e gestão.</strong>
                {" "}Documentos consolidados, com dados sensíveis sob responsabilidade da Coordenação.
              </>}
            >
              <Tabs value={gestaoSub} onValueChange={setGestaoSub}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="mensal">Mensal Consolidado</TabsTrigger>
                  <TabsTrigger value="completo">Lote / Gestão (10 seções)</TabsTrigger>
                  <TabsTrigger value="rede">Integridade & Banco</TabsTrigger>
                </TabsList>
                <TabsContent value="mensal" className="mt-3">
                  <DashboardRelatorioMensalTab />
                </TabsContent>
                <TabsContent value="completo" className="mt-3">
                  <ExportarRelatoriosPage />
                </TabsContent>
                <TabsContent value="rede" className="mt-3">
                  <Section items={[
                    {
                      titulo: "Integridade dos Dados",
                      descricao: "Pendências e inconsistências cadastrais para revisão.",
                      destinatario: "Coord. · Interno", formato: "Web",
                      conteudo: ["Vínculos faltantes", "Educadores sem turma", "Participantes sem responsável", "Datas e marcos incoerentes"],
                      to: "/integridade",
                    },
                    {
                      titulo: "Banco de Dados (Backup)",
                      descricao: "Exportação completa em ZIP e administração de baixo nível.",
                      destinatario: "Coord.", formato: "ZIP",
                      conteudo: ["Backup completo do banco", "Tabelas individuais em CSV/JSON", "Histórico de exportações"],
                      to: "/banco-de-dados",
                    },
                    {
                      titulo: "Relatório da Equipe Técnica",
                      descricao: "Atendimentos, encaminhamentos e roteiros de visita domiciliar.",
                      destinatario: "Coord. · MP", formato: "Web",
                      conteudo: ["Volume diário desduplicado", "Vulnerabilidade por território", "Roteiros e cards expansíveis"],
                      to: "/equipe-tecnica",
                    },
                  ]} />
                </TabsContent>
              </Tabs>
            </EmbeddedFlow>
          )}
        </TabsContent>

        <TabsContent value="oficiais">
          <Card className="mt-4 border-l-4 border-l-primary/60 bg-muted/30">
            <CardContent className="p-3 text-xs text-muted-foreground flex gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <div>
                <strong className="text-foreground">Documentos para a rede de proteção.</strong> Cada arquivo é baixado localmente e — quando o Google Drive estiver
                conectado — uma cópia é salva em <code>SYSCFV/RelatoriosOficiais/&lt;categoria&gt;</code>.
              </div>
            </CardContent>
          </Card>
          <Section items={oficiais} />
        </TabsContent>
      </Tabs>

      <FichaReferenciamentoDialog open={openFicha} onOpenChange={setOpenFicha} />
      <FaltasConsecutivasDialog open={openFaltas} onOpenChange={setOpenFaltas} />
      <CoberturaPrioritariaDialog open={openCobertura} onOpenChange={setOpenCobertura} />
      <EvasaoDialog open={openEvasao} onOpenChange={setOpenEvasao} />
      <EncaminhamentosDialog open={openEncs} onOpenChange={setOpenEncs} />
      <BoletimArticulacaoDialog open={openBoletim} onOpenChange={setOpenBoletim} />
      <BoletimPedagogicoDialog open={openBoletimPed} onOpenChange={setOpenBoletimPed} />
    </div>
  );
}