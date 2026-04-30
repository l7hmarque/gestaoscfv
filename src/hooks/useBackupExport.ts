import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { generateXLSXBuffer } from "./useDataExport";

function ts() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}_${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`;
}

const dateStr = () => new Date().toISOString().slice(0, 10);

export function useBackupExport() {
  const [loading, setLoading] = useState(false);

  const doBackup = async (categories: string[], dateFrom?: string, dateTo?: string) => {
    setLoading(true);
    try {
      const zip = new JSZip();

      if (categories.includes("Participantes")) {
        const { data } = await supabase.from("participantes").select("*").order("nome_completo");
        if (data?.length) {
          const headers = [
            { key: "nome_completo", label: "Nome" }, { key: "data_nascimento", label: "Nascimento" },
            { key: "genero", label: "Gênero" }, { key: "cor_raca", label: "Cor/Raça" },
            { key: "periodo", label: "Período" }, { key: "status", label: "Status" },
            { key: "escola", label: "Escola" }, { key: "serie", label: "Série" },
            { key: "endereco_rua", label: "Rua" }, { key: "endereco_numero", label: "Nº" },
            { key: "endereco_bairro", label: "Bairro" }, { key: "responsavel1_nome", label: "Responsável 1" },
            { key: "responsavel1_whatsapp", label: "WhatsApp 1" }, { key: "responsavel1_cpf", label: "CPF 1" },
            { key: "categoria_vulnerabilidade", label: "Vulnerabilidade" }, { key: "laudo", label: "Laudo" },
            { key: "restricao_alimentar", label: "Restrição Alimentar" },
          ];
          zip.file(`Participantes/SysCFV_Participantes_${dateStr()}.xlsx`, generateXLSXBuffer(data, headers, "Participantes"));
        }
      }

      if (categories.includes("Turmas")) {
        const { data } = await supabase.from("turmas").select("*").order("nome");
        if (data?.length) {
          const headers = [
            { key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" },
            { key: "periodo", label: "Período" }, { key: "faixa_etaria", label: "Faixa Etária" },
            { key: "dias_semana", label: "Dias" }, { key: "ativa", label: "Ativa" },
          ];
          const mapped = data.map(t => ({ ...t, dias_semana: t.dias_semana?.join(", ") || "", ativa: t.ativa ? "Sim" : "Não" }));
          zip.file(`Turmas/SysCFV_Turmas_${dateStr()}.xlsx`, generateXLSXBuffer(mapped, headers, "Turmas"));
        }
      }

      if (categories.includes("Presenca")) {
        let q = supabase.from("presenca").select("*, participantes(nome_completo), turmas(nome)").order("data", { ascending: false });
        if (dateFrom) q = q.gte("data", dateFrom);
        if (dateTo) q = q.lte("data", dateTo);
        const { data } = await q;
        if (data?.length) {
          const mapped = data.map((p: any) => ({
            data: p.data, turma: p.turmas?.nome || "", participante: p.participantes?.nome_completo || "",
            presente: p.presente ? "Sim" : "Não", justificativa: p.justificativa || "",
          }));
          const headers = [
            { key: "data", label: "Data" }, { key: "turma", label: "Turma" },
            { key: "participante", label: "Participante" }, { key: "presente", label: "Presente" },
            { key: "justificativa", label: "Justificativa" },
          ];
          zip.file(`Presenca/SysCFV_Presenca_${dateStr()}.xlsx`, generateXLSXBuffer(mapped, headers, "Presença"));
        }
      }

      if (categories.includes("Relatorios")) {
        let q = supabase.from("relatorios_atividade").select("*, profiles!relatorios_atividade_educador_id_fkey(nome)").order("data", { ascending: false });
        if (dateFrom) q = q.gte("data", dateFrom);
        if (dateTo) q = q.lte("data", dateTo);
        const { data } = await q;
        if (data?.length) {
          const mapped = data.map((r: any) => ({
            data: r.data, nome_atividade: r.nome_atividade || "", educador: r.profiles?.nome || "",
            score_elo: r.score_elo ?? "", pct_adesao: r.pct_adesao ?? "",
            num_participantes: r.num_participantes ?? "", objetivo_alcancado: r.objetivo_alcancado || "",
          }));
          const headers = [
            { key: "data", label: "Data" }, { key: "nome_atividade", label: "Atividade" },
            { key: "educador", label: "Educador" }, { key: "score_elo", label: "Score ELO" },
            { key: "pct_adesao", label: "% Adesão" }, { key: "num_participantes", label: "Participantes" },
            { key: "objetivo_alcancado", label: "Objetivo" },
          ];
          zip.file(`Relatorios/SysCFV_Relatorios_Dados_${dateStr()}.xlsx`, generateXLSXBuffer(mapped, headers, "Relatórios"));
        }
      }

      if (categories.includes("Planejamentos")) {
        let q = supabase.from("planejamentos").select("*, profiles!planejamentos_educador_id_fkey(nome)").order("created_at", { ascending: false });
        if (dateFrom) q = q.gte("data_aplicacao", dateFrom);
        if (dateTo) q = q.lte("data_aplicacao", dateTo);
        const { data } = await q;
        if (data?.length) {
          const mapped = data.map((p: any) => ({
            titulo: p.titulo, tema: p.tema || "", educador: p.profiles?.nome || "",
            data_aplicacao: p.data_aplicacao || "", objetivos: p.objetivos || "",
            forma_avaliacao: p.forma_avaliacao?.join(", ") || "",
          }));
          const headers = [
            { key: "titulo", label: "Título" }, { key: "tema", label: "Tema" },
            { key: "educador", label: "Educador" }, { key: "data_aplicacao", label: "Data Aplicação" },
            { key: "objetivos", label: "Objetivos" }, { key: "forma_avaliacao", label: "Avaliação" },
          ];
          zip.file(`Planejamentos/SysCFV_Planejamentos_Dados_${dateStr()}.xlsx`, generateXLSXBuffer(mapped, headers, "Planejamentos"));
        }
      }

      if (categories.includes("Profissionais")) {
        // Sem campos sensíveis no backup do cliente (RH só pela coordenação via RPC).
        const { data } = await supabase.from("profiles").select("id, user_id, nome, cargo, ativo, email, data_inicio, foto_url").order("nome");
        const { data: roles } = await supabase.from("user_roles").select("*");
        const roleMap = new Map<string, string[]>();
        (roles || []).forEach((r: any) => {
          const arr = roleMap.get(r.user_id) || [];
          arr.push(r.role);
          roleMap.set(r.user_id, arr);
        });
        if (data?.length) {
          const mapped = data.map((p: any) => ({
            nome: p.nome, cargo: p.cargo || "", role: (roleMap.get(p.user_id) || []).join(", "),
            ativo: p.ativo ? "Sim" : "Não",
          }));
          const headers = [
            { key: "nome", label: "Nome" }, { key: "cargo", label: "Cargo" },
            { key: "role", label: "Função" }, { key: "ativo", label: "Ativo" },
          ];
          zip.file(`Profissionais/SysCFV_Profissionais_${dateStr()}.xlsx`, generateXLSXBuffer(mapped, headers, "Profissionais"));
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `SysCFV_Backup_${ts()}.zip`);
    } finally {
      setLoading(false);
    }
  };

  return { doBackup, loading };
}
