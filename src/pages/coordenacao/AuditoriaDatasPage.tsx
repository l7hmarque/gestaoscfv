import { useState } from "react";
import { ArrowLeft, AlertTriangle, Calendar, History, FileWarning, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDataBR, formatDataHoraBR } from "@/lib/formatDate";

type Auditoria = {
  totais?: Record<string, number>;
  desligamentos_futuros?: any[];
  entrada_apos_saida?: any[];
  nasc_apos_cadastro?: any[];
  clusters_import?: any[];
  ambiguas_em_cluster?: any[];
  relatorios_futuros?: any[];
  transferencias_futuras?: any[];
  error?: string;
};

const AuditoriaDatasPage = () => {
  const [tab, setTab] = useState("desligamentos");

  const { data, isLoading, isError } = useQuery<Auditoria>({
    queryKey: ["auditoria-datas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("auditar_datas_invertidas" as any);
      if (error) throw error;
      return (data ?? {}) as Auditoria;
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || data?.error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Sem permissão ou erro ao carregar a auditoria.</p>
      </div>
    );
  }

  const totais = data?.totais ?? {};
  const desligamentos = data?.desligamentos_futuros ?? [];
  const entradaSaida = data?.entrada_apos_saida ?? [];
  const nasc = data?.nasc_apos_cadastro ?? [];
  const clusters = data?.clusters_import ?? [];
  const ambiguas = data?.ambiguas_em_cluster ?? [];
  const relatoriosFut = data?.relatorios_futuros ?? [];
  const transfFut = data?.transferencias_futuras ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/coordenacao"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Auditoria de Datas</h1>
          <p className="text-xs text-muted-foreground">
            Detecta inversões DD↔MM, datas futuras impossíveis e clusters de import suspeitos. Apenas leitura.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard icon={Calendar} label="Desligamentos futuros" value={totais.desligamentos_futuros ?? 0} alert={Number(totais.desligamentos_futuros) > 0} />
        <KpiCard icon={History} label="Entrada > Saída" value={totais.entrada_apos_saida ?? 0} alert={Number(totais.entrada_apos_saida) > 0} />
        <KpiCard icon={FileWarning} label="Clusters de import" value={totais.clusters_import ?? 0} alert={Number(totais.clusters_import) > 0} />
        <KpiCard icon={AlertTriangle} label="Ambíguas em cluster" value={totais.ambiguas_em_cluster ?? 0} alert={Number(totais.ambiguas_em_cluster) > 0} />
      </div>

      <Card>
        <CardContent className="p-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="desligamentos">Desligamentos Futuros <Badge variant="secondary" className="ml-2">{desligamentos.length}</Badge></TabsTrigger>
              <TabsTrigger value="ambiguas">Ambíguas <Badge variant="secondary" className="ml-2">{ambiguas.length}</Badge></TabsTrigger>
              <TabsTrigger value="clusters">Clusters <Badge variant="secondary" className="ml-2">{clusters.length}</Badge></TabsTrigger>
              <TabsTrigger value="entradasaida">Entrada/Saída <Badge variant="secondary" className="ml-2">{entradaSaida.length}</Badge></TabsTrigger>
              <TabsTrigger value="nasc">Nascimento <Badge variant="secondary" className="ml-2">{nasc.length}</Badge></TabsTrigger>
              <TabsTrigger value="relfut">Relatórios Futuros <Badge variant="secondary" className="ml-2">{relatoriosFut.length}</Badge></TabsTrigger>
              <TabsTrigger value="transffut">Transf. Futuras <Badge variant="secondary" className="ml-2">{transfFut.length}</Badge></TabsTrigger>
            </TabsList>

            <TabsContent value="desligamentos" className="mt-3">
              <ListaTable rows={desligamentos} cols={[
                { k: "nome", h: "Participante" },
                { k: "data_atual", h: "Data atual", fmt: formatDataBR },
                { k: "data_proposta", h: "Data proposta (DD↔MM)", fmt: formatDataBR },
                { k: "motivo_desligamento", h: "Motivo" },
                { k: "updated_at", h: "Atualizado em", fmt: formatDataHoraBR },
              ]} link={(r) => `/participantes/${r.id}`} />
            </TabsContent>

            <TabsContent value="ambiguas" className="mt-3">
              <ListaTable rows={ambiguas} cols={[
                { k: "nome", h: "Participante" },
                { k: "data_atual", h: "Data atual", fmt: formatDataBR },
                { k: "data_proposta", h: "Data proposta", fmt: formatDataBR },
                { k: "tem_audit", h: "Tem audit?", fmt: (v) => v ? "Sim" : "Não" },
                { k: "updated_at", h: "Atualizado em", fmt: formatDataHoraBR },
              ]} link={(r) => `/participantes/${r.id}`} />
            </TabsContent>

            <TabsContent value="clusters" className="mt-3">
              <ListaTable rows={clusters} cols={[
                { k: "updated_at", h: "Timestamp do import", fmt: formatDataHoraBR },
                { k: "qtd", h: "Registros afetados" },
              ]} />
              <p className="text-xs text-muted-foreground mt-2">
                Clusters com 5+ registros desligados no mesmo instante indicam importação em lote — provável origem de inversões DD↔MM.
              </p>
            </TabsContent>

            <TabsContent value="entradasaida" className="mt-3">
              <ListaTable rows={entradaSaida} cols={[
                { k: "participante", h: "Participante" },
                { k: "turma", h: "Turma" },
                { k: "data_entrada", h: "Entrada", fmt: formatDataBR },
                { k: "data_saida", h: "Saída", fmt: formatDataBR },
              ]} />
            </TabsContent>

            <TabsContent value="nasc" className="mt-3">
              <ListaTable rows={nasc} cols={[
                { k: "nome", h: "Participante" },
                { k: "data_nascimento", h: "Nascimento", fmt: formatDataBR },
                { k: "created_at", h: "Cadastrado em", fmt: formatDataHoraBR },
              ]} link={(r) => `/participantes/${r.id}`} />
            </TabsContent>

            <TabsContent value="relfut" className="mt-3">
              <ListaTable rows={relatoriosFut} cols={[
                { k: "titulo", h: "Relatório" },
                { k: "data", h: "Data registrada", fmt: formatDataBR },
                { k: "created_at", h: "Criado em", fmt: formatDataHoraBR },
              ]} link={(r) => `/relatorios/${r.id}`} />
            </TabsContent>

            <TabsContent value="transffut" className="mt-3">
              <ListaTable rows={transfFut} cols={[
                { k: "participante", h: "Participante" },
                { k: "data_transferencia", h: "Transferência", fmt: formatDataBR },
                { k: "created_at", h: "Criado em", fmt: formatDataHoraBR },
              ]} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, alert }: any) => (
  <Card className={alert ? "border-destructive/40" : ""}>
    <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
      <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
      <Icon className={`h-4 w-4 ${alert ? "text-destructive" : "text-muted-foreground"}`} />
    </CardHeader>
    <CardContent className="pt-0">
      <div className={`text-2xl font-semibold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </CardContent>
  </Card>
);

const ListaTable = ({
  rows, cols, link,
}: {
  rows: any[];
  cols: { k: string; h: string; fmt?: (v: any) => string }[];
  link?: (row: any) => string;
}) => {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nada a sinalizar aqui.</p>;
  }
  return (
    <div className="overflow-x-auto rounded border">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => <TableHead key={c.k} className="text-xs">{c.h}</TableHead>)}
            {link && <TableHead className="text-xs w-20">Abrir</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={r.id ?? i}>
              {cols.map((c) => (
                <TableCell key={c.k} className="text-xs">
                  {c.fmt ? c.fmt(r[c.k]) : (r[c.k] ?? "—")}
                </TableCell>
              ))}
              {link && (
                <TableCell className="text-xs">
                  <Link to={link(r)} className="text-primary hover:underline">Ver</Link>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AuditoriaDatasPage;