import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RotateCcw, Percent, TrendingUp, Upload, FileText, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const TEMPLATES = [
  { key: "relatorio.docx", label: "Relatório de Atividade", description: "Tags: {DATA}, {EDUCADOR}, {TURMAS}, {NOME_ATIVIDADE}, {SCORE_ELO}, {#PRESENCA}..." },
  { key: "planejamento.docx", label: "Planejamento", description: "Tags: {TITULO}, {EDUCADOR}, {DATA_APLICACAO}, {TURMAS}, {TEMA}, {OBJETIVOS}..." },
  { key: "ficha_inscricao.docx", label: "Ficha de Inscrição", description: "Tags: {NOME_COMPLETO}, {DATA_NASCIMENTO}, {GENERO}, {ESCOLA}, {SERIE}..." },
  { key: "matriz_frequencia.docx", label: "Matriz de Frequência", description: "Tags: {TURMA}, {PERIODO}, {FAIXA_ETARIA}, {#PARTICIPANTES}..." },
];

export default function DashboardAdminTab() {
  const [resettingElo, setResettingElo] = useState(false);
  const [resettingFreq, setResettingFreq] = useState(false);
  const [uploadedTemplates, setUploadedTemplates] = useState<Record<string, boolean>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    checkTemplates();
  }, []);

  const checkTemplates = async () => {
    const { data } = await supabase.storage.from("templates").list();
    if (data) {
      const map: Record<string, boolean> = {};
      data.forEach(f => { map[f.name] = true; });
      setUploadedTemplates(map);
    }
  };

  const handleUpload = async (templateKey: string, file: File) => {
    if (!file.name.endsWith(".docx")) {
      toast.error("Apenas arquivos .docx são aceitos");
      return;
    }
    setUploading(templateKey);
    const { error } = await supabase.storage.from("templates").upload(templateKey, file, { upsert: true });
    setUploading(null);
    if (error) { toast.error("Erro no upload: " + error.message); return; }
    toast.success(`Template "${templateKey}" enviado com sucesso`);
    setUploadedTemplates(prev => ({ ...prev, [templateKey]: true }));
  };

  const handleRemove = async (templateKey: string) => {
    const { error } = await supabase.storage.from("templates").remove([templateKey]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`Template "${templateKey}" removido`);
    setUploadedTemplates(prev => { const n = { ...prev }; delete n[templateKey]; return n; });
  };

  const resetElo = async () => {
    setResettingElo(true);
    const { error } = await supabase.from("relatorios_atividade").update({
      score_elo: null, iniciativa: null, autonomia: null,
      colaboracao: null, comunicacao: null, respeito_mutuo: null,
    } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    setResettingElo(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Scores ELO resetados com sucesso");
  };

  const resetFrequencia = async () => {
    setResettingFreq(true);
    const { error } = await supabase.from("relatorios_atividade").update({
      pct_adesao: null, num_participantes: null, num_ausentes: null, num_matriculados: null,
    } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    setResettingFreq(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Dados de frequência resetados com sucesso");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Administração</h2>

      {/* Templates Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Modelos DOCX Institucionais
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Faça upload dos modelos DOCX com as tags nos campos. O sistema preencherá automaticamente com os dados do banco.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {TEMPLATES.map(t => (
            <div key={t.key} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.label}</span>
                  {uploadedTemplates[t.key] ? (
                    <Badge variant="default" className="text-[10px] gap-1"><Check className="h-3 w-3" />Enviado</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] gap-1"><X className="h-3 w-3" />Não enviado</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.description}</p>
              </div>
              <div className="flex gap-1 ml-2">
                <input
                  type="file"
                  accept=".docx"
                  className="hidden"
                  ref={el => { fileInputRefs.current[t.key] = el; }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(t.key, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={uploading === t.key}
                  onClick={() => fileInputRefs.current[t.key]?.click()}
                >
                  <Upload className="h-3 w-3" />
                  {uploading === t.key ? "Enviando..." : uploadedTemplates[t.key] ? "Substituir" : "Enviar"}
                </Button>
                {uploadedTemplates[t.key] && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleRemove(t.key)}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reset Section */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <TrendingUp className="h-4 w-4" /> Resetar Scores ELO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Zera todos os scores ELO e competências de todos os relatórios. Esta ação é irreversível.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={resettingElo}>
                  <RotateCcw className="h-4 w-4 mr-1" /> {resettingElo ? "Resetando..." : "Resetar ELO"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reset de ELO</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os scores ELO e competências serão zerados. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={resetElo}>Confirmar Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <Percent className="h-4 w-4" /> Resetar % Frequência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Zera todos os dados de frequência/adesão de todos os relatórios. Esta ação é irreversível.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={resettingFreq}>
                  <RotateCcw className="h-4 w-4 mr-1" /> {resettingFreq ? "Resetando..." : "Resetar Frequência"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reset de Frequência</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os dados de adesão e frequência serão zerados. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={resetFrequencia}>Confirmar Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
