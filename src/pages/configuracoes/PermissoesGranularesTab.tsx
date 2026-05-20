import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck, RotateCcw, Lock } from "lucide-react";
import { ALL_MODULES, MODULE_LABELS, ModuleKey, ModuleLevel } from "@/hooks/useCapabilities";
import { useAuditLog } from "@/hooks/useAuditLog";

interface Profile { id: string; user_id: string; nome: string; cargo: string | null; ativo: boolean | null }
interface UserRole { user_id: string; role: string }
interface Override { user_id: string; module: string; level: ModuleLevel }

const LEVEL_OPTIONS: { value: ModuleLevel; label: string; color: string }[] = [
  { value: "none",  label: "Nenhum",  color: "text-muted-foreground" },
  { value: "read",  label: "Leitura", color: "text-blue-700" },
  { value: "write", label: "Edição",  color: "text-emerald-700" },
  { value: "admin", label: "Admin",   color: "text-destructive" },
];

export function PermissoesGranularesTab() {
  const { log } = useAuditLog();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [defaults, setDefaults] = useState<Record<string, Record<string, ModuleLevel>>>({}); // user_id -> module -> default
  const [superAdmins, setSuperAdmins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");

  async function carregar() {
    setLoading(true);
    const [pRes, rRes, oRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, nome, cargo, ativo").eq("ativo", true).order("nome"),
      (supabase.from as any)("user_roles").select("user_id, role"),
      (supabase.from as any)("user_module_access").select("user_id, module, level"),
    ]);
    const ps = (pRes.data ?? []) as Profile[];
    setProfiles(ps);
    setRoles((rRes.data ?? []) as UserRole[]);
    setOverrides((oRes.data ?? []) as Override[]);

    // Calcular defaults: chamada paralela ao RPC default_module_level para cada user/module
    // Em vez disso, derivamos no client a partir dos roles (espelha matriz do backend)
    const defs: Record<string, Record<string, ModuleLevel>> = {};
    const sa = new Set<string>();
    for (const p of ps) {
      const myRoles = new Set((rRes.data ?? []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role));
      defs[p.user_id] = {};
      for (const m of ALL_MODULES) defs[p.user_id][m] = clientDefault(myRoles, m);
    }
    setDefaults(defs);

    // Super admin via RPC (chama uma vez por profile seria lento; só destacamos quem é "l7hmarque@gmail.com")
    // Carregar emails dos profiles para detectar super admin
    const { data: emails } = await supabase.from("profiles").select("user_id, email");
    (emails ?? []).forEach((e: any) => {
      if (e.email && e.email.toLowerCase() === "l7hmarque@gmail.com") sa.add(e.user_id);
    });
    setSuperAdmins(sa);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  function clientDefault(myRoles: Set<string>, m: ModuleKey): ModuleLevel {
    if (myRoles.has("coordenacao")) return "admin";
    if (myRoles.has("visitante") && myRoles.size === 1) return "read";
    const tec = myRoles.has("tecnico"), edu = myRoles.has("educador"), mot = myRoles.has("motorista"),
          coz = myRoles.has("cozinheiro"), mkt = myRoles.has("marketing");
    switch (m) {
      case "dashboard": return (tec||edu||mot||coz||mkt) ? "read" : "none";
      case "participantes": return tec ? "write" : (edu||mot) ? "read" : "none";
      case "turmas": return (edu||tec) ? "read" : "none";
      case "presenca": return edu ? "write" : tec ? "read" : "none";
      case "planejamentos": case "relatorios": return (edu||tec) ? "write" : "none";
      case "registros_fotograficos": return (edu||tec||mkt) ? "write" : "none";
      case "cronograma": return (edu||tec||mot) ? "read" : "none";
      case "transporte": return mot ? "write" : (tec||edu) ? "read" : "none";
      case "cozinha": return coz ? "write" : "none";
      case "feed": return (tec||edu||mot||coz||mkt) ? "write" : "none";
      case "equipe_tecnica": return tec ? "write" : "none";
      case "integridade": return tec ? "read" : "none";
      case "site_publico": return mkt ? "write" : "none";
      default: return "none";
    }
  }

  const overrideMap = useMemo(() => {
    const m = new Map<string, ModuleLevel>();
    overrides.forEach((o) => m.set(`${o.user_id}:${o.module}`, o.level));
    return m;
  }, [overrides]);

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return profiles.filter((p) => !q || p.nome.toLowerCase().includes(q) || (p.cargo ?? "").toLowerCase().includes(q));
  }, [profiles, filtro]);

  const visibleModules = moduleFilter === "all" ? ALL_MODULES : [moduleFilter];

  async function setLevel(profile: Profile, module: ModuleKey, newLevel: ModuleLevel) {
    if (superAdmins.has(profile.user_id)) {
      toast.error("Super admin não pode ter permissões alteradas");
      return;
    }
    const myRoles = new Set(roles.filter((r) => r.user_id === profile.user_id).map((r) => r.role));
    if (myRoles.has("coordenacao")) {
      toast.error("Coordenação não pode ter permissões reduzidas");
      return;
    }

    const key = `${profile.user_id}:${module}`;
    setSavingCell(key);
    const defaultLevel = defaults[profile.user_id]?.[module] ?? "none";

    try {
      if (newLevel === defaultLevel) {
        // Remove override — volta ao default
        await (supabase.from as any)("user_module_access")
          .delete().eq("user_id", profile.user_id).eq("module", module);
        setOverrides((prev) => prev.filter((o) => !(o.user_id === profile.user_id && o.module === module)));
        await log({ acao: "permissao_reset", tabela: "user_module_access", registro_id: profile.user_id, detalhes: `${module} resetado ao padrão (${defaultLevel}) — ${profile.nome}` });
      } else {
        const { data: existing } = await (supabase.from as any)("user_module_access")
          .select("id").eq("user_id", profile.user_id).eq("module", module).maybeSingle();
        if (existing) {
          await (supabase.from as any)("user_module_access").update({ level: newLevel }).eq("id", existing.id);
        } else {
          await (supabase.from as any)("user_module_access").insert({
            user_id: profile.user_id, module, level: newLevel,
          });
        }
        setOverrides((prev) => {
          const without = prev.filter((o) => !(o.user_id === profile.user_id && o.module === module));
          return [...without, { user_id: profile.user_id, module, level: newLevel }];
        });
        await log({ acao: "permissao_alterada", tabela: "user_module_access", registro_id: profile.user_id, detalhes: `${module} → ${newLevel} (${profile.nome})` });
      }
      toast.success("Permissão atualizada");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSavingCell(null);
    }
  }

  async function resetUser(profile: Profile) {
    if (!confirm(`Remover todos os overrides de ${profile.nome}? Os papéis dele continuam.`)) return;
    await (supabase.from as any)("user_module_access").delete().eq("user_id", profile.user_id);
    setOverrides((prev) => prev.filter((o) => o.user_id !== profile.user_id));
    await log({ acao: "permissao_reset_total", tabela: "user_module_access", registro_id: profile.user_id, detalhes: `Overrides removidos para ${profile.nome}` });
    toast.success("Permissões resetadas para o padrão dos papéis");
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Permissões granulares por módulo</CardTitle>
          <CardDescription>
            Cada profissional herda permissões dos papéis atribuídos. Use os seletores abaixo para sobrescrever individualmente.
            Coordenação sempre tem acesso total e não pode ser limitada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar profissional..." className="pl-8" />
            </div>
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as any)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {ALL_MODULES.map((m) => <SelectItem key={m} value={m}>{MODULE_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/40 min-w-[180px]">Profissional</th>
                  {visibleModules.map((m) => (
                    <th key={m} className="p-1 text-center min-w-[120px] font-medium">{MODULE_LABELS[m as ModuleKey]}</th>
                  ))}
                  <th className="p-2 text-center w-20">Reset</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const isSA = superAdmins.has(p.user_id);
                  const myRoles = roles.filter((r) => r.user_id === p.user_id).map((r) => r.role);
                  const isCoord = myRoles.includes("coordenacao");
                  const locked = isSA || isCoord;
                  return (
                    <tr key={p.user_id} className="border-t hover:bg-accent/20">
                      <td className="p-2 sticky left-0 bg-background">
                        <div className="flex items-center gap-2">
                          {locked && <Lock className="h-3 w-3 text-destructive" />}
                          <div>
                            <p className="font-medium">{p.nome}</p>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {isSA && <Badge variant="outline" className="h-4 text-[9px] border-destructive text-destructive">Super</Badge>}
                              {myRoles.map((r) => <Badge key={r} variant="secondary" className="h-4 text-[9px]">{r}</Badge>)}
                            </div>
                          </div>
                        </div>
                      </td>
                      {visibleModules.map((m) => {
                        const mod = m as ModuleKey;
                        const def = isSA ? "admin" : (defaults[p.user_id]?.[mod] ?? "none");
                        const override = overrideMap.get(`${p.user_id}:${mod}`);
                        const effective: ModuleLevel = locked ? "admin" : (override ?? def);
                        const isOverride = !!override && override !== def;
                        const key = `${p.user_id}:${mod}`;
                        return (
                          <td key={mod} className="p-1 text-center">
                            {savingCell === key ? (
                              <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                            ) : (
                              <Select
                                value={effective}
                                disabled={locked}
                                onValueChange={(v) => setLevel(p, mod, v as ModuleLevel)}
                              >
                                <SelectTrigger className={`h-7 text-xs px-2 ${isOverride ? "border-primary ring-1 ring-primary/30" : ""}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LEVEL_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      <span className={o.color}>{o.label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center">
                        <Button size="icon" variant="ghost" disabled={locked} title="Reset overrides" onClick={() => resetUser(p)}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={visibleModules.length + 2} className="text-center py-6 text-muted-foreground">Nenhum profissional.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-muted-foreground space-y-1 border-t pt-2">
            <p><span className="inline-block w-3 h-3 border border-primary rounded-sm ring-1 ring-primary/30 align-middle mr-1" /> Borda azul = override personalizado (diferente do padrão do papel).</p>
            <p><Lock className="h-3 w-3 inline mr-1 text-destructive" /> Cadeado = Super admin ou Coordenação (não editável).</p>
            <p>Selecionar o mesmo valor do padrão remove automaticamente o override.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}