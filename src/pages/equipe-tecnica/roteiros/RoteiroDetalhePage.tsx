import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Calendar, Car, CheckCircle2, Clock, Download, Loader2, MapPin, Phone, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useRoteiro, useRoteiroVisitas, useAtualizarVisita, useAtualizarRoteiro, useExcluirRoteiro, STATUS_VISITA_LABELS, STATUS_VISITA_COLORS, STATUS_ROTEIRO_LABELS, STATUS_ROTEIRO_COLORS } from "@/hooks/useRoteirosVisita";
import { displayAge } from "@/lib/constants";
import { sysCfvFileName } from "@/lib/fileNaming";
import jsPDF from "jspdf";

export default function RoteiroDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: roteiro, isLoading } = useRoteiro(id);
  const { data: visitas } = useRoteiroVisitas(id);
  const atualizarV = useAtualizarVisita();
  const atualizarR = useAtualizarRoteiro();
  const excluir = useExcluirRoteiro();

  const [partsMap, setPartsMap] = useState<Record<string, any>>({});
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!visitas || visitas.length === 0) return;
    const ids = Array.from(new Set(visitas.map(v => v.participante_id)));
    supabase.from("participantes")
      .select("id, nome_completo, data_nascimento, endereco_rua, endereco_numero, endereco_bairro, responsavel1_nome, responsavel1_whatsapp, responsavel2_nome, responsavel2_whatsapp, periodo, restricao_alimentar, status")
      .in("id", ids).then(({ data }) => {
        const m: Record<string, any> = {};
        (data ?? []).forEach((p: any) => { m[p.id] = p; });
        setPartsMap(m);
      });
  }, [visitas]);

  useEffect(() => {
    if (!roteiro) return;
    const ids = roteiro.responsaveis ?? [];
    if (ids.length === 0) return;
    supabase.from("profiles").select("id, nome").in("id", ids).then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { m[p.id] = p.nome; });
      setProfMap(m);
    });
  }, [roteiro]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setMyProfileId(data.id);
    });
  }, [user]);

  const visitasPorBairro = useMemo(() => {
    const m: Record<string, typeof visitas> = {};
    (visitas ?? []).forEach(v => {
      const b = v.bairro_nome ?? "Sem bairro";
      if (!m[b]) m[b] = [];
      m[b]!.push(v);
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [visitas]);

  const stats = useMemo(() => {
    const total = visitas?.length ?? 0;
    const realizadas = visitas?.filter(v => v.status_visita === "realizada").length ?? 0;
    return { total, realizadas, pct: total > 0 ? Math.round((realizadas / total) * 100) : 0 };
  }, [visitas]);

  const gerarAtendimento = async (visitaId: string, participanteId: string, relato: string) => {
    if (!myProfileId) { toast.error("Perfil não identificado"); return; }
    if (!relato?.trim()) { toast.error("Preencha o relato antes"); return; }
    const { data: atd, error } = await supabase.from("atendimentos").insert({
      participante_id: participanteId,
      profissional_id: myProfileId,
      data_atendimento: roteiro!.data_visita,
      tipo: "visita_domiciliar",
      descricao: relato,
    } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)("roteiro_visitas").update({ atendimento_id: atd.id }).eq("id", visitaId);
    toast.success("Atendimento registrado");
  };

  const exportarPdf = () => {
    if (!roteiro || !visitas) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 14;

    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Roteiro de Visita Domiciliar", pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(11); doc.text(roteiro.titulo, pageW / 2, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const [yy, mm, dd] = roteiro.data_visita.slice(0,10).split("-");
    const dataBR = `${dd}/${mm}/${yy}`;
    const respNomes = (roteiro.responsaveis ?? []).map(id => profMap[id] ?? "").filter(Boolean).join(", ");
    doc.text(`Data: ${dataBR}${roteiro.horario_saida ? `   Saída: ${roteiro.horario_saida}` : ""}${roteiro.veiculo ? `   Veículo: ${roteiro.veiculo}` : ""}`, 14, y);
    y += 5;
    if (respNomes) { doc.text(`Responsáveis: ${respNomes}`, 14, y); y += 5; }
    doc.text(`Total de visitas: ${visitas.length}`, 14, y);
    y += 6;
    doc.setDrawColor(150); doc.line(14, y, pageW - 14, y); y += 4;

    visitasPorBairro.forEach(([bairro, lista]) => {
      if (y > pageH - 30) { doc.addPage(); y = 14; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(`Bairro: ${bairro}  (${lista!.length})`, 14, y);
      y += 5;
      lista!.forEach((v, idx) => {
        const p = partsMap[v.participante_id] ?? {};
        const cardH = 36;
        if (y + cardH > pageH - 14) { doc.addPage(); y = 14; }
        doc.setDrawColor(180); doc.setLineWidth(0.2);
        doc.rect(14, y, pageW - 28, cardH);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(`${idx + 1}. ${p.nome_completo ?? "—"}`, 16, y + 5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        const tag = v.origem === "busca_ativa" ? "[BUSCA ATIVA]" : "[MATRÍCULA NOVA]";
        doc.text(tag, pageW - 16, y + 5, { align: "right" });
        doc.text(`Idade: ${displayAge(p.data_nascimento) || "—"}   Período: ${(p.periodo ?? "—").toString()}`, 16, y + 10);
        doc.text(`Endereço: ${p.endereco_rua ?? "—"}, ${p.endereco_numero ?? "s/n"} - ${p.endereco_bairro ?? "—"}`, 16, y + 14);
        doc.text(`Responsável: ${p.responsavel1_nome ?? "—"}   Tel: ${p.responsavel1_whatsapp ?? "—"}`, 16, y + 18);
        if (p.responsavel2_nome) doc.text(`Resp. 2: ${p.responsavel2_nome} - ${p.responsavel2_whatsapp ?? "—"}`, 16, y + 22);
        doc.text("Resultado: (   ) Realizada  (   ) Não atendido  (   ) Recusou  (   ) End. não localizado", 16, y + 28);
        doc.text("Anotações: ____________________________________________________________________", 16, y + 33);
        y += cardH + 2;
      });
      y += 2;
    });

    // Footer pagination
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(120);
      doc.text(`Página ${i} de ${pages}`, pageW / 2, pageH - 6, { align: "center" });
    }

    doc.save(sysCfvFileName("RoteiroVisita", "pdf", roteiro.titulo.replace(/[^\w\d]+/g, "_").slice(0, 40)));
  };

  if (isLoading || !roteiro) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const [yy, mm, dd] = roteiro.data_visita.slice(0, 10).split("-");
  const dataBR = `${dd}/${mm}/${yy}`;

  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => nav("/equipe-tecnica")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{roteiro.titulo}</h1>
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {dataBR}</span>
              {roteiro.horario_saida && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {roteiro.horario_saida}</span>}
              {roteiro.veiculo && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {roteiro.veiculo}</span>}
              <span>{stats.realizadas}/{stats.total} ({stats.pct}%)</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={STATUS_ROTEIRO_COLORS[roteiro.status]}>{STATUS_ROTEIRO_LABELS[roteiro.status]}</Badge>
          <Button size="sm" variant="outline" onClick={exportarPdf}><Download className="h-4 w-4 mr-1" /> PDF</Button>
          {roteiro.status !== "concluido" && (
            <Button size="sm" onClick={() => atualizarR.mutate({ id: roteiro.id, status: "concluido", concluido_em: new Date().toISOString() })}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir roteiro?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação remove o roteiro e todas as visitas vinculadas. Atendimentos já gerados serão preservados.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => excluir.mutate(roteiro.id, { onSuccess: () => nav("/equipe-tecnica") })}>Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {roteiro.observacoes && (
        <Card><CardContent className="p-3 text-sm bg-muted/30">{roteiro.observacoes}</CardContent></Card>
      )}

      <div className="space-y-5">
        {visitasPorBairro.map(([bairro, lista]) => (
          <div key={bairro} className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wide">{bairro}</h2>
              <Badge variant="outline" className="text-[10px]">{lista!.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lista!.map((v, idx) => (
                <VisitaCard
                  key={v.id}
                  ordem={idx + 1}
                  visita={v}
                  participante={partsMap[v.participante_id]}
                  onAtualizar={(patch) => atualizarV.mutate({ id: v.id, ...patch })}
                  onGerarAtd={(relato) => gerarAtendimento(v.id, v.participante_id, relato)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitaCard({ ordem, visita, participante, onAtualizar, onGerarAtd }: any) {
  const [relato, setRelato] = useState(visita.relato ?? "");
  const [horario, setHorario] = useState(visita.horario_realizado ?? "");

  useEffect(() => {
    setRelato(visita.relato ?? "");
    setHorario(visita.horario_realizado ?? "");
  }, [visita.id]);

  const p = participante ?? {};
  return (
    <Card className={`border-l-4 ${visita.status_visita === "realizada" ? "border-l-green-600" : visita.status_visita === "pendente" ? "border-l-gray-300" : "border-l-orange-500"}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{ordem}</span>
              {p.nome_completo ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {displayAge(p.data_nascimento) || "—"} • {p.periodo ?? "—"}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${visita.origem === "busca_ativa" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
            {visita.origem === "busca_ativa" ? "BA" : "Matrícula"}
          </Badge>
        </div>

        <div className="text-xs space-y-1 bg-muted/30 rounded p-2">
          <p className="flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {p.endereco_rua ?? "—"}, {p.endereco_numero ?? "s/n"}</p>
          <p className="flex items-center gap-1"><User className="h-3 w-3" /> {p.responsavel1_nome ?? "—"}</p>
          <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.responsavel1_whatsapp ?? "—"}</p>
          {p.restricao_alimentar && <p className="text-amber-700">⚠ {p.restricao_alimentar}</p>}
        </div>

        <div className="flex items-center gap-2">
          <Select value={visita.status_visita} onValueChange={(v) => onAtualizar({ status_visita: v })}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_VISITA_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="time" value={horario} onChange={e => setHorario(e.target.value)} onBlur={() => onAtualizar({ horario_realizado: horario || null })} className="h-8 text-xs w-[100px]" />
        </div>

        <Textarea value={relato} onChange={e => setRelato(e.target.value)} onBlur={() => onAtualizar({ relato: relato || null })} placeholder="Relato da visita..." rows={2} className="text-xs" />

        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`text-[10px] ${STATUS_VISITA_COLORS[visita.status_visita]}`}>
            {STATUS_VISITA_LABELS[visita.status_visita]}
          </Badge>
          {visita.atendimento_id ? (
            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">Atendimento gerado ✓</Badge>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onGerarAtd(relato)} disabled={!relato.trim()}>
              Gerar atendimento
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}