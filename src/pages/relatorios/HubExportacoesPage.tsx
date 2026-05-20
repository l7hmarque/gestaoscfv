import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { FolderDown, ClipboardCheck, FileText, BarChart3, Shield, HeartHandshake, ExternalLink, Play } from "lucide-react";
import FichaReferenciamentoDialog from "./oficiais/FichaReferenciamentoDialog";
import FaltasConsecutivasDialog from "./oficiais/FaltasConsecutivasDialog";
import CoberturaPrioritariaDialog from "./oficiais/CoberturaPrioritariaDialog";
import EvasaoDialog from "./oficiais/EvasaoDialog";
import EncaminhamentosDialog from "./oficiais/EncaminhamentosDialog";
import BoletimArticulacaoDialog from "./oficiais/BoletimArticulacaoDialog";
import BoletimPedagogicoDialog from "./oficiais/BoletimPedagogicoDialog";

type CardSpec = {
  titulo: string;
  descricao: string;
  destinatario: string;
  to?: string;
  action?: () => void;
  actionLabel?: string;
};

function ReportCard({ c }: { c: CardSpec }) {
  return (
    <Card className="border-border/60 hover:border-primary/40 transition-colors">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{c.titulo}</h3>
          <Badge variant="outline" className="text-[10px] shrink-0">{c.destinatario}</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-snug min-h-[2.5rem]">{c.descricao}</p>
        <div className="pt-1">
          {c.action ? (
            <Button size="sm" className="w-full h-8" onClick={c.action}>
              <Play className="h-3.5 w-3.5 mr-1" /> {c.actionLabel || "Gerar agora"}
            </Button>
          ) : c.to ? (
            <Button asChild size="sm" variant="outline" className="w-full h-8">
              <Link to={c.to}><ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir página</Link>
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
      {items.map((c) => <ReportCard key={c.titulo} c={c} />)}
    </div>
  );
}

export default function HubExportacoesPage() {
  const [tab, setTab] = useState("oficiais");
  const [openFicha, setOpenFicha] = useState(false);
  const [openFaltas, setOpenFaltas] = useState(false);
  const [openCobertura, setOpenCobertura] = useState(false);
  const [openEvasao, setOpenEvasao] = useState(false);
  const [openEncs, setOpenEncs] = useState(false);
  const [openBoletim, setOpenBoletim] = useState(false);
  const [openBoletimPed, setOpenBoletimPed] = useState(false);

  const presenca: CardSpec[] = [
    { titulo: "Exportar Chamada", descricao: "Listas de presença/frequência por turma, dia ou mês — XLSX e Google Sheets.", destinatario: "Interno", to: "/presenca/exportar" },
    { titulo: "Conferência de Presença", descricao: "Página operacional para marcar e ajustar presenças.", destinatario: "Interno", to: "/presenca" },
  ];

  const atividades: CardSpec[] = [
    { titulo: "Relatórios de Atividade", descricao: "Listagem de relatórios pedagógicos com filtros e ranking ELO.", destinatario: "Interno", to: "/relatorios" },
    { titulo: "Exportar em Lote", descricao: "DOCX, PDF e XLSX de múltiplos relatórios de atividade.", destinatario: "Interno · Coord.", to: "/relatorios/exportar" },
    { titulo: "Planejamentos", descricao: "Banco de planejamentos institucionais.", destinatario: "Interno", to: "/planejamentos" },
  ];

  const gestao: CardSpec[] = [
    { titulo: "Relatório de Gestão", descricao: "10 seções técnicas consolidadas para diretoria e órgãos gestores.", destinatario: "Gestão · Governo", to: "/relatorios/exportar" },
    { titulo: "Dashboard Operacional", descricao: "KPIs em tempo real, screenshot e exportação.", destinatario: "Coord.", to: "/dashboard" },
    { titulo: "Cronograma Semanal", descricao: "Logística por território (1260×785).", destinatario: "Interno", to: "/cronograma" },
    { titulo: "Equipe Técnica", descricao: "Vulnerabilidade, eventos e roteiros de visita.", destinatario: "Coord. · MP", to: "/equipe-tecnica" },
    { titulo: "Coordenação", descricao: "Painel da coordenação: produtividade, auditoria, registros.", destinatario: "Coord.", to: "/coordenacao" },
    { titulo: "Integridade de Dados", descricao: "Pendências e inconsistências cadastrais.", destinatario: "Interno", to: "/integridade" },
    { titulo: "Banco de Dados", descricao: "Backup completo e exportações em massa.", destinatario: "Coord.", to: "/banco-de-dados" },
  ];

  const oficiais: CardSpec[] = [
    {
      titulo: "Ficha de Referenciamento",
      descricao: "Documento individual em PDF com identificação, vínculo familiar, frequência e busca ativa.",
      destinatario: "CRAS · CREAS · CT · MP",
      action: () => setOpenFicha(true), actionLabel: "Selecionar participante",
    },
    {
      titulo: "Faltas Consecutivas com Alerta",
      descricao: "Lista de participantes acima de N faltas seguidas, com sugestão de encaminhamento.",
      destinatario: "Conselho Tutelar · Coord.",
      action: () => setOpenFaltas(true),
    },
    {
      titulo: "Cobertura de Público Prioritário",
      descricao: "Cruza meta territorial × atendidos × categorias de vulnerabilidade (PBF, BPC, ECA…).",
      destinatario: "SAS · Controladoria · MP",
      action: () => setOpenCobertura(true),
    },
    {
      titulo: "Relatório de Evasão",
      descricao: "Desligamentos no período com motivo, permanência e histórico de busca ativa.",
      destinatario: "SAS · CRAS · Coord.",
      action: () => setOpenEvasao(true),
    },
    {
      titulo: "Encaminhamentos por Órgão",
      descricao: "Lista detalhada e resumo por órgão (CRAS, CREAS, Conselho Tutelar, UBS, MP).",
      destinatario: "Rede · MP",
      action: () => setOpenEncs(true),
    },
    {
      titulo: "Boletim de Articulação com a Rede",
      descricao: "Consolidado mensal: atendidos, ingressos, desligamentos, busca ativa e encaminhamentos.",
      destinatario: "SAS · Controladoria",
      action: () => setOpenBoletim(true),
    },
    {
      titulo: "Boletim Pedagógico Individual",
      descricao: "Evolução do participante: frequência mês a mês, atividades, relatos da equipe e encaminhamentos.",
      destinatario: "Família · Rede",
      action: () => setOpenBoletimPed(true), actionLabel: "Selecionar participante",
    },
  ];

  const familia: CardSpec[] = [
    { titulo: "Portal da Família", descricao: "Painel do responsável com presenças, comunicados e formulários.", destinatario: "Família", to: "/familia" },
    { titulo: "Site Público", descricao: "Indicadores e notícias para a comunidade.", destinatario: "Comunidade", to: "/site" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader icon={<FolderDown className="h-5 w-5" />} title="Hub de Exportações" subtitle="Catálogo único de relatórios — escolha por tipo de documento ou destinatário." />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="presenca" className="gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> Presença</TabsTrigger>
          <TabsTrigger value="atividades" className="gap-1"><FileText className="h-3.5 w-3.5" /> Atividades</TabsTrigger>
          <TabsTrigger value="gestao" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Gestão</TabsTrigger>
          <TabsTrigger value="oficiais" className="gap-1"><Shield className="h-3.5 w-3.5" /> Oficiais <Badge variant="secondary" className="text-[9px] px-1 h-4">NOVO</Badge></TabsTrigger>
          <TabsTrigger value="familia" className="gap-1"><HeartHandshake className="h-3.5 w-3.5" /> Família</TabsTrigger>
        </TabsList>

        <TabsContent value="presenca"><Section items={presenca} /></TabsContent>
        <TabsContent value="atividades"><Section items={atividades} /></TabsContent>
        <TabsContent value="gestao"><Section items={gestao} /></TabsContent>
        <TabsContent value="oficiais">
          <p className="text-xs text-muted-foreground mt-3 mb-1">
            Relatórios formatados para a rede de proteção. Cada arquivo é baixado localmente e — quando o Google Drive estiver
            conectado — uma cópia é salva em <code>SYSCFV/RelatoriosOficiais/&lt;categoria&gt;</code>.
          </p>
          <Section items={oficiais} />
        </TabsContent>
        <TabsContent value="familia"><Section items={familia} /></TabsContent>
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