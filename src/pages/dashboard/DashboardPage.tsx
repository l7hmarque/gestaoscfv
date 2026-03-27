import { useDashboardData } from "@/hooks/useDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, GraduationCap, FileText, BookOpen, TrendingUp, Percent, Clock, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";
import DashboardProfissionaisTab from "./DashboardProfissionaisTab";
import DashboardTransporteTab from "./DashboardTransporteTab";
import DashboardAdminTab from "./DashboardAdminTab";
import DashboardRelatorioMensalTab from "./DashboardRelatorioMensalTab";

const COLORS = ["hsl(0,65%,67%)", "hsl(210,22%,49%)", "hsl(45,80%,55%)", "hsl(150,45%,45%)", "hsl(280,40%,55%)", "hsl(30,70%,55%)"];
const OBJ_LABELS: Record<string, string> = { alcancado: "Alcançado", parcial: "Parcial", nao_alcancado: "Não Alcançado" };

function KPICard({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4 flex items-center gap-3">
        <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10"}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${accent ? "text-white" : "text-primary"}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
          <p className="text-lg sm:text-xl font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-[9px] sm:text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function IndicadoresTab() {
  const { data, loading } = useDashboardData();
  if (loading || !data) return <div className="p-6 text-sm text-muted-foreground">Carregando indicadores...</div>;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        <KPICard icon={Users} label="Participantes Ativos" value={data.totalParticipantesAtivos} />
        <KPICard icon={GraduationCap} label="Turmas Ativas" value={data.totalTurmasAtivas} />
        <KPICard icon={FileText} label="Relatórios" value={data.totalRelatorios} />
        <KPICard icon={BookOpen} label="Planejamentos" value={data.totalPlanejamentos} />
        <KPICard icon={TrendingUp} label="Média ELO" value={data.mediaELO.toFixed(2)} sub="de 5.00" accent="bg-primary" />
        <KPICard icon={Percent} label="Média Adesão" value={`${data.mediaAdesao.toFixed(0)}%`} />
        <KPICard icon={Activity} label="Frequência Geral" value={`${data.taxaFrequenciaGeral}%`} sub="presenças registradas" />
        <KPICard icon={Clock} label="Educadores Ativos" value={data.topEducadores.length} sub="com relatórios" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Faixa Etária</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.participantesPorFaixa} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Participantes" fill="hsl(0,65%,67%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Gênero</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.participantesPorGenero} dataKey="count" nameKey="genero" cx="50%" cy="50%" outerRadius={65} label={({ genero, percent }) => `${genero} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                  {data.participantesPorGenero.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Período</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.participantesPorPeriodo} dataKey="count" nameKey="periodo" cx="50%" cy="50%" outerRadius={65} label={({ periodo, percent }) => `${periodo} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                  {data.participantesPorPeriodo.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Bairro (top 10)</CardTitle></CardHeader>
          <CardContent className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.participantesPorBairro} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="bairro" tick={{ fontSize: 9 }} width={80} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" name="Participantes" fill="hsl(210,22%,49%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Educadores (Relatórios)</CardTitle></CardHeader>
          <CardContent className="h-52">
            {data.topEducadores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topEducadores} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 9 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Relatórios" fill="hsl(150,45%,45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Score ELO Mensal</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-56">
            {data.eloMensal.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.eloMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="elo" name="ELO" stroke="hsl(0,65%,67%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">% Adesão Mensal</CardTitle></CardHeader>
          <CardContent className="h-48 sm:h-56">
            {data.adesaoMensal.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.adesaoMensal} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="adesao" name="Adesão %" stroke="hsl(210,22%,49%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Competências ELO</CardTitle></CardHeader>
          <CardContent className="h-56 sm:h-64">
            {data.competencias.some(c => c.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data.competencias}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                  <Radar name="Média" dataKey="value" stroke="hsl(0,65%,67%)" fill="hsl(0,65%,67%)" fillOpacity={0.3} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Objetivos Alcançados</CardTitle></CardHeader>
          <CardContent className="h-56 sm:h-64">
            {data.objetivos.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.objetivos.map(o => ({ ...o, label: OBJ_LABELS[o.status] || o.status }))} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Relatórios" radius={[4, 4, 0, 0]}>
                    {data.objetivos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground pt-8 text-center">Sem dados</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Gestão do SCFV</p>
      </div>

      <Tabs defaultValue="indicadores" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="indicadores" className="text-xs sm:text-sm">Indicadores</TabsTrigger>
          <TabsTrigger value="profissionais" className="text-xs sm:text-sm">Profissionais</TabsTrigger>
          <TabsTrigger value="transporte" className="text-xs sm:text-sm">Transporte</TabsTrigger>
          <TabsTrigger value="relatorio-mensal" className="text-xs sm:text-sm">Rel. Mensal</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs sm:text-sm">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="indicadores"><IndicadoresTab /></TabsContent>
        <TabsContent value="profissionais"><DashboardProfissionaisTab /></TabsContent>
        <TabsContent value="transporte"><DashboardTransporteTab /></TabsContent>
        <TabsContent value="relatorio-mensal"><DashboardRelatorioMensalTab /></TabsContent>
        <TabsContent value="admin"><DashboardAdminTab /></TabsContent>
      </Tabs>
    </div>
  );
}
