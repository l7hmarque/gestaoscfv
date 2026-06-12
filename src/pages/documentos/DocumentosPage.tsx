import { useState, useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import {
  FolderDown, ClipboardCheck, FileText, BarChart3, Shield,
  ExternalLink, Play, Lock, Info,
} from "lucide-react";
import { useCapabilities } from "@/hooks/useCapabilities";

// 4 diálogos oficiais que efetivamente são usados pela rede de proteção
import FichaReferenciamentoDialog from "../relatorios/oficiais/FichaReferenciamentoDialog";
import FaltasConsecutivasDialog from "../relatorios/oficiais/FaltasConsecutivasDialog";
import CoberturaPrioritariaDialog from "../relatorios/oficiais/CoberturaPrioritariaDialog";
import EvasaoDialog from "../relatorios/oficiais/EvasaoDialog";
import EvolucaoSASDialog from "../relatorios/oficiais/EvolucaoSASDialog";

// Fluxos pesados — lazy para não pesar a primeira carga
const PresencaExportarPage = lazy(() => import("../presenca/PresencaExportarPage"));
const ExportarRelatoriosPage = lazy(() => import("../relatorios/ExportarRelatoriosPage"));

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
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FolderDown className="h-5 w-5" />}
        title={t("documents.title")}
        subtitle={t("documents.subtitle")}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="presenca" className="gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> {t("documents.tab_attendance")}</TabsTrigger>
          <TabsTrigger value="atividades" className="gap-1"><FileText className="h-3.5 w-3.5" /> {t("documents.tab_activities")}</TabsTrigger>
          <TabsTrigger value="gestao" className="gap-1" disabled={!canGestao}>
            <BarChart3 className="h-3.5 w-3.5" /> {t("documents.tab_management")} {!canGestao && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="oficiais" className="gap-1">
            <Shield className="h-3.5 w-3.5" /> {t("documents.tab_official")}
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
              <strong className="text-foreground">Relatórios pedagógicos em lote.</strong> Exporta todos os relatórios de atividade do período em DOCX, PDF e XLSX. Para o catálogo navegável, abra <Link to="/relatorios" className="text-primary underline">Relatórios</Link>.
            </>}
          >
            <ExportarRelatoriosPage mode="pedagogico" />
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
                <strong className="text-foreground">Relatórios institucionais para governo, MP e gestão.</strong>
                {" "}Relatório Mensal SCFV, Anual, Atendimentos Técnicos e Relatório de Gestão (10 seções) — dados sensíveis sob responsabilidade da Coordenação.
              </>}
            >
              <ExportarRelatoriosPage mode="institucional" />
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
    </div>
  );
}