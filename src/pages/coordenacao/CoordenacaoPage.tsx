import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Loader2, UserX, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCoordenacaoData } from "@/hooks/useCoordenacaoData";
import { PainelCoordenadorTab } from "./PainelCoordenadorTab";
import { RegistrosTab } from "./RegistrosTab";
import { PermissoesTab } from "./PermissoesTab";
import { AcessosFamiliaTab } from "./AcessosFamiliaTab";
import { ProdutividadeTab } from "./ProdutividadeTab";
import { AuditoriaTab } from "./AuditoriaTab";
import DashboardAdminTab from "../dashboard/DashboardAdminTab";

export default function CoordenacaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("painel");
  const [periodo, setPeriodo] = useState("30");
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isCoord = (data ?? []).some((r: any) => r.role === "coordenacao");
      if (!isCoord) {
        toast({ title: "Acesso restrito", description: "Apenas perfis de Coordenação acessam este módulo.", variant: "destructive" });
        navigate("/dashboard");
        return;
      }
      setAllowed(true);
      setAuthChecked(true);
    })();
  }, [user, navigate]);

  const { data, isLoading, error, refetch } = useCoordenacaoData(parseInt(periodo, 10));

  if (!authChecked || !allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary"><Briefcase className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">Coordenação</h1>
            <p className="text-sm text-muted-foreground">Hub de gestão, KPIs e decisões da coordenação técnica.</p>
          </div>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-7xl grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 h-auto">
          <TabsTrigger value="painel">Painel</TabsTrigger>
          <TabsTrigger value="acoes">Ações Pendentes</TabsTrigger>
          <TabsTrigger value="decisoes">Decisões</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade</TabsTrigger>
          <TabsTrigger value="produtividade">Produtividade</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="familia">Portal Família</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="desligamento">Desligamento</TabsTrigger>
          <TabsTrigger value="administracao">Administração</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error || !data ? (
          <Card className="mt-6">
            <CardContent className="p-6 space-y-3 text-sm">
              <p className="font-medium text-destructive">Não foi possível carregar os dados da Coordenação.</p>
              <p className="text-muted-foreground text-xs">{(error as any)?.message ?? "Resposta vazia do servidor."}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="painel" className="mt-6"><PainelCoordenadorTab data={data} /></TabsContent>

            <TabsContent value="acoes" className="mt-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Fila Priorizada</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <FilaItem label="Transferências aguardando aprovação" count={data.gestao.acoes_pendentes.transferencias_pendentes} link="/participantes" />
                  <FilaItem label="Pendências de integridade" count={data.pendencias?.total ?? 0} link="/integridade" />
                  <FilaItem label="Recados técnicos pendentes" count={data.gestao.acoes_pendentes.recados_tecnicos_pendentes} link="/feed" />
                  <FilaItem label="Avisos expirando em 7 dias" count={data.gestao.acoes_pendentes.avisos_expirando_7d} link="/configuracoes" />
                  <FilaItem label="Encaminhamentos abertos > 30 dias" count={data.gestao.acoes_pendentes.encaminhamentos_abertos_30d} link="/equipe-tecnica" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="decisoes" className="mt-6">
              <Card className="mb-3 border-l-4 border-l-primary/60">
                <CardContent className="p-4 text-xs text-muted-foreground">
                  <p><strong className="text-foreground">O que são as Decisões?</strong> Indicadores automáticos derivados do log de auditoria — contam ações da Coordenação registradas no sistema (aprovações, exclusões justificadas, desligamentos validados). Para registrar reuniões, comunicados, tarefas e ações manuais, use a aba <strong className="text-foreground">Registros</strong>.</p>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCard label="Decisões registradas (você)" value={data.gestao.decisoes.proprias_periodo} />
                <StatCard label="Decisões da equipe" value={data.gestao.decisoes.equipe_periodo} />
                <StatCard label="Aprovações concedidas" value={data.gestao.decisoes.aprovacoes} />
                <StatCard label="Exclusões justificadas" value={data.gestao.decisoes.exclusoes} />
                <StatCard label="Desligamentos validados" value={data.gestao.decisoes.desligamentos_validados} />
              </div>
              <p className="text-xs text-muted-foreground mt-4">Período: últimos {periodo} dias. Log completo no histórico de auditoria.</p>
            </TabsContent>

            <TabsContent value="qualidade" className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="% Educadores ativos no mês" value={`${data.gestao.qualidade.pct_educadores_ativos}%`} />
                <StatCard label="% Turmas com educador" value={`${data.gestao.qualidade.pct_turmas_com_educador}%`} />
                <StatCard label="% Planejamentos com turma" value={`${data.gestao.qualidade.pct_planej_com_turma}%`} />
                <StatCard label="Tempo médio transferência" value={`${data.gestao.qualidade.tempo_medio_transferencia_dias}d`} />
                <StatCard label="Atividades registradas (período)" value={data.gestao.atividades_periodo?.count ?? 0} />
                <StatCard label="Tempo dedicado (min)" value={data.gestao.atividades_periodo?.minutos_totais ?? 0} />
                <StatCard label="% Relatórios com foto" value={`${(data as any).gestao.qualidade_extra?.pct_relatorios_com_foto ?? 0}%`} />
                <StatCard label="% Relatórios com IA" value={`${(data as any).gestao.qualidade_extra?.pct_relatorios_com_analise_ia ?? 0}%`} />
                <StatCard label="Acessos família (período)" value={(data as any).gestao.qualidade_extra?.acessos_familia_periodo ?? 0} />
                <StatCard label="Permanência média (dias)" value={(data as any).gestao.qualidade_extra?.permanencia_media_dias ?? 0} />
                <StatCard label="Recados téc. pendentes" value={(data as any).gestao.qualidade_extra?.recados_tecnicos_status?.pendentes ?? 0} />
                <StatCard label="Recados téc. respondidos" value={(data as any).gestao.qualidade_extra?.recados_tecnicos_status?.respondidos ?? 0} />
              </div>
              {(data as any).gestao.qualidade_extra?.presenca_por_bairro?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Presença média por bairro (período)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-4 flex-wrap">
                      {(data as any).gestao.qualidade_extra.presenca_por_bairro.map((b: any) => (
                        <div key={b.bairro} className="text-sm">
                          <p className="text-xs text-muted-foreground">{b.bairro}</p>
                          <p className="text-xl font-bold">{b.pct ?? 0}%</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {(data as any).gestao.qualidade_extra?.top_educadores_elo?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Top educadores por ELO</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead><tr className="text-xs text-muted-foreground text-left border-b"><th className="py-2">Educador</th><th>ELO médio</th><th>Relatórios</th></tr></thead>
                      <tbody>
                        {(data as any).gestao.qualidade_extra.top_educadores_elo.map((e: any) => (
                          <tr key={e.nome} className="border-b last:border-0">
                            <td className="py-2 font-medium">{e.nome}</td>
                            <td>{e.elo_medio}</td>
                            <td>{e.qtd}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle className="text-base">Cobertura Territorial vs Metas</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="py-2">Bairro</th><th>Manhã</th><th>Tarde</th><th>Idosos</th><th>Total</th></tr></thead>
                      <tbody>
                        {data.gestao.cobertura_metas.map((b) => (
                          <tr key={b.bairro} className="border-b last:border-0">
                            <td className="py-2 font-medium">{b.bairro}</td>
                            <td>{b.real_manha} / {b.meta_criancas_manha}</td>
                            <td>{b.real_tarde} / {b.meta_criancas_tarde}</td>
                            <td>— / {b.meta_idosos}</td>
                            <td className="font-semibold">{b.real_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="produtividade" className="mt-6"><ProdutividadeTab /></TabsContent>
            <TabsContent value="auditoria" className="mt-6"><AuditoriaTab /></TabsContent>

            <TabsContent value="registros" className="mt-6"><RegistrosTab /></TabsContent>
            <TabsContent value="familia" className="mt-6"><AcessosFamiliaTab /></TabsContent>
            <TabsContent value="permissoes" className="mt-6"><PermissoesTab /></TabsContent>

            <TabsContent value="desligamento" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserX className="h-4 w-4 text-destructive" />
                    Painel Administrativo de Desligamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Soft-delete em lote de participantes inativos com justificativa registrada em auditoria.
                    Restrito a Coordenação. Use com cautela — alterações afetam relatórios retroativos.
                  </p>
                  <Button onClick={() => navigate("/desligamento-admin")} className="gap-2">
                    <ExternalLink className="h-4 w-4" /> Abrir painel
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="administracao" className="mt-6">
              <Card className="mb-3 border-l-4 border-l-primary/60">
                <CardContent className="p-4 text-xs text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Administração técnica.</strong> Sincronização do Drive institucional,
                    resets controlados (ELO/frequência) e ferramentas de manutenção. Use com cautela — ações afetam dados
                    históricos e relatórios retroativos. Tudo é registrado em auditoria.
                  </p>
                </CardContent>
              </Card>
              <DashboardAdminTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function FilaItem({ label, count, link }: { label: string; count: number; link: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/40 transition-colors">
      <span>{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-bold">{count}</span>
        <a href={link} className="text-xs text-primary underline">abrir</a>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-l-4 border-l-primary/60">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}