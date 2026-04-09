import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Building2, MapPin, Users, FileText, Shield, Database, Loader2 } from "lucide-react";

const CONFIG_KEYS = [
  { key: "nome_entidade", label: "Nome da Entidade", default: "Sociedade Civil Nossa Senhora Aparecida" },
  { key: "nome_centro", label: "Nome do Centro", default: "Centro de Atenção Integral ao Adolescente - Medianeira" },
  { key: "cnpj", label: "CNPJ", default: "" },
  { key: "endereco", label: "Endereço", default: "" },
  { key: "telefone", label: "Telefone", default: "" },
  { key: "email_institucional", label: "E-mail Institucional", default: "" },
  { key: "convenio_numero", label: "Nº do Convênio/Termo", default: "001/2022" },
  { key: "presidente_nome", label: "Nome do Presidente", default: "Raúl Oscar Sena Vélez" },
  { key: "presidente_cpf", label: "CPF do Presidente", default: "801.780.489-09" },
];

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [bairros, setBairros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cfgData }, { data: bData }] = await Promise.all([
      supabase.from("configuracoes_gerais").select("*"),
      supabase.from("bairros").select("*").order("nome"),
    ]);
    const map: Record<string, string> = {};
    CONFIG_KEYS.forEach(k => { map[k.key] = k.default; });
    (cfgData || []).forEach((c: any) => { map[c.chave] = c.valor || ""; });
    setConfigs(map);
    setBairros(bData || []);
    setLoading(false);
  };

  const saveConfigs = async () => {
    setSaving(true);
    for (const [chave, valor] of Object.entries(configs)) {
      const { data: existing } = await supabase.from("configuracoes_gerais").select("id").eq("chave", chave).maybeSingle();
      if (existing) {
        await supabase.from("configuracoes_gerais").update({ valor } as any).eq("id", existing.id);
      } else {
        await supabase.from("configuracoes_gerais").insert({ chave, valor } as any);
      }
    }
    setSaving(false);
    toast.success("Configurações salvas!");
  };

  const updateBairroMeta = async (id: string, field: string, value: number) => {
    const { error } = await supabase.from("bairros").update({ [field]: value } as any).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setBairros(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    toast.success("Meta atualizada");
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configurações Gerais</h1>
        <p className="text-sm text-muted-foreground">Configurações institucionais e parâmetros do sistema</p>
      </div>

      <Tabs defaultValue="instituicao" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="instituicao"><Building2 className="h-4 w-4 mr-1" />Instituição</TabsTrigger>
          <TabsTrigger value="bairros"><MapPin className="h-4 w-4 mr-1" />Bairros/Metas</TabsTrigger>
          <TabsTrigger value="equipe"><Users className="h-4 w-4 mr-1" />Equipe</TabsTrigger>
          <TabsTrigger value="sistema"><Shield className="h-4 w-4 mr-1" />Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="instituicao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Institucionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {CONFIG_KEYS.map(k => (
                  <div key={k.key}>
                    <Label className="text-xs">{k.label}</Label>
                    <Input
                      value={configs[k.key] || ""}
                      onChange={e => setConfigs(prev => ({ ...prev, [k.key]: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={saveConfigs} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bairros">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bairros e Metas SCFV</CardTitle>
              <p className="text-xs text-muted-foreground">Defina as metas de atendimento por bairro</p>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Bairro</TableHead>
                      <TableHead className="text-xs text-center">Meta Crianças (Manhã)</TableHead>
                      <TableHead className="text-xs text-center">Meta Crianças (Tarde)</TableHead>
                      <TableHead className="text-xs text-center">Meta Idosos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bairros.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="text-sm font-medium">{b.nome}</TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 w-20 mx-auto text-center text-sm" defaultValue={b.meta_criancas_manha || 0}
                            onBlur={e => updateBairroMeta(b.id, "meta_criancas_manha", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 w-20 mx-auto text-center text-sm" defaultValue={b.meta_criancas_tarde || 0}
                            onBlur={e => updateBairroMeta(b.id, "meta_criancas_tarde", Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" className="h-8 w-20 mx-auto text-center text-sm" defaultValue={b.meta_idosos || 0}
                            onBlur={e => updateBairroMeta(b.id, "meta_idosos", Number(e.target.value))} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5" />Perfis e Cargos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">Em breve: gerenciamento de cargos e permissões dos profissionais.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sistema">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5" />Templates DOCX</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">Em breve: upload e gestão de templates de documentos.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-5 w-5" />Segurança</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">Em breve: timeout de sessão e configurações de auditoria.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-5 w-5" />Backup</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground py-4 text-center">Em breve: exportação completa do banco de dados.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
