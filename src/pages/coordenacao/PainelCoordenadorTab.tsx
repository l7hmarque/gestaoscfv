import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Users, GraduationCap, Activity, TrendingUp, AlertTriangle, ArrowRightLeft, Bell, MessageSquare, FileText, ExternalLink } from "lucide-react";
import type { CoordenacaoStats } from "@/hooks/useCoordenacaoData";

type Origem = "Operacional" | "Gestão" | "Integridade";

const origemColor: Record<Origem, string> = {
  Operacional: "border-l-blue-500",
  "Gestão": "border-l-amber-500",
  Integridade: "border-l-red-500",
};

function KpiCard({ label, value, icon: Icon, origem, hint, to }: { label: string; value: string | number; icon: any; origem: Origem; hint?: string; to?: string }) {
  const content = (
    <Card className={`border-l-4 ${origemColor[origem]} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="text-[9px] px-1 py-0">{origem}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function PainelCoordenadorTab({ data }: { data: CoordenacaoStats }) {
  const d = data.dashboard ?? {};
  const p = data.pendencias ?? {};
  const g = data.gestao;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Contexto Operacional</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Participantes Ativos" value={d.totalParticipantesAtivos ?? 0} icon={Users} origem="Operacional" hint={d.deltaParticipantes != null ? `${d.deltaParticipantes >= 0 ? "+" : ""}${d.deltaParticipantes} em 30d` : undefined} />
          <KpiCard label="Turmas Ativas" value={d.totalTurmasAtivas ?? 0} icon={GraduationCap} origem="Operacional" />
          <KpiCard label="Taxa de Frequência" value={`${d.taxaFrequenciaGeral ?? 0}%`} icon={Activity} origem="Operacional" />
          <KpiCard label="Média ELO" value={d.mediaELO ?? 0} icon={TrendingUp} origem="Operacional" hint={`base: ${d.mediaELON ?? 0} relatórios`} />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Ações da Coordenação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Pendências de Integridade" value={p.total ?? 0} icon={AlertTriangle} origem="Integridade" to="/integridade" />
          <KpiCard label="Transferências Pendentes" value={g.acoes_pendentes.transferencias_pendentes} icon={ArrowRightLeft} origem="Gestão" to="/participantes" />
          <KpiCard label="Avisos Ativos" value={g.acoes_pendentes.avisos_ativos} icon={Bell} origem="Gestão" hint={`${g.acoes_pendentes.avisos_expirando_7d} expirando em 7d`} />
          <KpiCard label="Recados Técnicos" value={g.acoes_pendentes.recados_tecnicos_pendentes} icon={MessageSquare} origem="Gestão" to="/feed" />
          <KpiCard label="Encaminhamentos > 30d" value={g.acoes_pendentes.encaminhamentos_abertos_30d} icon={ExternalLink} origem="Gestão" to="/equipe-tecnica" />
          <KpiCard label="Turmas sem Educador" value={p.turmas_sem_educador ?? 0} icon={GraduationCap} origem="Integridade" to="/integridade" />
          <KpiCard label="Turmas Vazias" value={p.turmas_vazias ?? 0} icon={GraduationCap} origem="Integridade" to="/integridade" />
          <KpiCard label="Planej. sem Turma" value={p.planejamentos_sem_turma ?? 0} icon={FileText} origem="Integridade" to="/integridade" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Qualidade da Gestão</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Educadores Ativos no Mês" value={`${g.qualidade.pct_educadores_ativos}%`} icon={Users} origem="Gestão" hint={`${g.qualidade.educadores_ativos_mes}/${g.qualidade.educadores_total}`} />
          <KpiCard label="Planejamentos com Turma" value={`${g.qualidade.pct_planej_com_turma}%`} icon={FileText} origem="Gestão" />
          <KpiCard label="Turmas com Educador" value={`${g.qualidade.pct_turmas_com_educador}%`} icon={GraduationCap} origem="Gestão" />
          <KpiCard label="Tempo médio Transferência" value={`${g.qualidade.tempo_medio_transferencia_dias}d`} icon={ArrowRightLeft} origem="Gestão" />
        </div>
      </section>

      <div className="flex gap-2 pt-2">
        <Button asChild variant="outline" size="sm"><Link to="/integridade">Abrir Integridade</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/desligamento-admin">Painel de Desligamento</Link></Button>
        <Button asChild variant="outline" size="sm"><Link to="/configuracoes">Configurações</Link></Button>
      </div>
    </div>
  );
}