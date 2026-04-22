import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search, ShieldCheck } from "lucide-react";

const ROLES: Array<{ key: string; label: string; descr: string }> = [
  { key: "coordenacao", label: "Coordenação", descr: "Acesso total — gestão, exclusões, permissões." },
  { key: "tecnico", label: "Técnico", descr: "Atendimentos, prontuários, encaminhamentos, financeiro." },
  { key: "educador", label: "Educador", descr: "Relatórios, planejamentos, presença e participantes." },
  { key: "motorista", label: "Motorista", descr: "Painel de transporte e rotas." },
  { key: "cozinheiro", label: "Cozinheiro", descr: "Visualização operacional restrita." },
  { key: "visitante", label: "Visitante", descr: "Somente leitura — modo demonstração." },
];

interface Profile { id: string; user_id: string; nome: string; ativo: boolean | null; cargo: string | null; }
interface UserRole { user_id: string; role: string; }

export function PermissoesTab() {
  const { log } = useAuditLog();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const [{ data: ps }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("id, user_id, nome, ativo, cargo").eq("ativo", true).order("nome"),
      (supabase.from as any)("user_roles").select("user_id, role"),
    ]);
    setProfiles((ps as any) ?? []);
    setRoles((rs as any) ?? []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  const rolesByUser = useMemo(() => {
    const m = new Map<string, Set<string>>();
    roles.forEach((r) => {
      if (!m.has(r.user_id)) m.set(r.user_id, new Set());
      m.get(r.user_id)!.add(r.role);
    });
    return m;
  }, [roles]);

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => p.nome.toLowerCase().includes(q) || (p.cargo ?? "").toLowerCase().includes(q));
  }, [profiles, filtro]);

  async function toggle(profile: Profile, role: string, hasRole: boolean) {
    const key = `${profile.user_id}:${role}`;
    setUpdating(key);

    // Anti lock-out: se for revogar 'coordenacao' e for o único, bloqueia
    if (hasRole && role === "coordenacao") {
      const totalCoord = roles.filter((r) => r.role === "coordenacao").length;
      if (totalCoord <= 1) {
        toast({ title: "Operação bloqueada", description: "Este é o único usuário com Coordenação. Conceda a outra pessoa antes de revogar.", variant: "destructive" });
        setUpdating(null);
        return;
      }
      if (!confirm(`Revogar Coordenação de ${profile.nome}?`)) { setUpdating(null); return; }
    }

    if (hasRole) {
      const { error } = await (supabase.from as any)("user_roles").delete().eq("user_id", profile.user_id).eq("role", role);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setUpdating(null); return; }
      await log({ acao: "role_revogada", tabela: "user_roles", registro_id: profile.user_id, detalhes: `${role} revogado de ${profile.nome}` });
      setRoles((prev) => prev.filter((r) => !(r.user_id === profile.user_id && r.role === role)));
    } else {
      const { error } = await (supabase.from as any)("user_roles").insert({ user_id: profile.user_id, role });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); setUpdating(null); return; }
      await log({ acao: "role_concedida", tabela: "user_roles", registro_id: profile.user_id, detalhes: `${role} concedido a ${profile.nome}` });
      setRoles((prev) => [...prev, { user_id: profile.user_id, role }]);
    }
    setUpdating(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Capacidades por papel</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {ROLES.map((r) => (
              <div key={r.key} className="p-2 rounded-md border">
                <p className="font-semibold text-sm">{r.label}</p>
                <p className="text-muted-foreground">{r.descr}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Permissões dos profissionais ativos</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar nome ou cargo..." className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">Profissional</th>
                    <th className="pr-3">Papéis</th>
                    {ROLES.map((r) => <th key={r.key} className="text-center px-1">{r.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => {
                    const userRoles = rolesByUser.get(p.user_id) ?? new Set<string>();
                    return (
                      <tr key={p.user_id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{p.nome}</p>
                          {p.cargo ? <p className="text-xs text-muted-foreground">{p.cargo}</p> : null}
                        </td>
                        <td className="pr-3"><Badge variant="outline" className="text-xs">{userRoles.size}</Badge></td>
                        {ROLES.map((r) => {
                          const has = userRoles.has(r.key);
                          const key = `${p.user_id}:${r.key}`;
                          return (
                            <td key={r.key} className="text-center px-1">
                              {updating === key ? (
                                <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                              ) : (
                                <Switch checked={has} onCheckedChange={() => toggle(p, r.key, has)} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {filtrados.length === 0 ? (
                    <tr><td colSpan={2 + ROLES.length} className="text-center py-6 text-sm text-muted-foreground">Nenhum profissional encontrado.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}