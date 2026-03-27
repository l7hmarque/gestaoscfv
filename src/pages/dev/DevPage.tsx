import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Trash2, Plus, Database, Users, BookOpen, FileText, ClipboardList, Bus } from "lucide-react";
import { toast } from "sonner";
import { Constants } from "@/integrations/supabase/types";

const ROLES = Constants.public.Enums.app_role;
const DEV_PASSWORD = "leoleo";

interface Profile { id: string; user_id: string; nome: string; email: string | null; cargo: string | null; }
interface Role { id: string; user_id: string; role: string; }

export default function DevPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("dev_auth") === "true");
  const [pw, setPw] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [addingRole, setAddingRole] = useState<{ userId: string; role: string } | null>(null);

  const handleLogin = () => {
    if (pw === DEV_PASSWORD) {
      sessionStorage.setItem("dev_auth", "true");
      setAuthed(true);
    } else {
      toast.error("Senha incorreta");
    }
  };

  useEffect(() => { if (authed) loadAll(); }, [authed]);

  const loadAll = async () => {
    setLoading(true);
    const [pRes, rRes, partRes, turmaRes, presRes, relRes, planRes, pontosRes] = await Promise.all([
      supabase.from("profiles").select("id, user_id, nome, email, cargo").order("nome"),
      supabase.from("user_roles").select("*"),
      supabase.from("participantes").select("id", { count: "exact", head: true }),
      supabase.from("turmas").select("id", { count: "exact", head: true }),
      supabase.from("presenca").select("id", { count: "exact", head: true }),
      supabase.from("relatorios_atividade").select("id", { count: "exact", head: true }),
      supabase.from("planejamentos").select("id", { count: "exact", head: true }),
      supabase.from("pontos_transporte").select("id", { count: "exact", head: true }),
    ]);
    setProfiles(pRes.data || []);
    setRoles(rRes.data || []);
    setCounts({
      participantes: partRes.count || 0,
      turmas: turmaRes.count || 0,
      presenca: presRes.count || 0,
      relatorios: relRes.count || 0,
      planejamentos: planRes.count || 0,
      pontos: pontosRes.count || 0,
    });
    setLoading(false);
  };

  const removeRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role removida");
    loadAll();
  };

  const addRole = async () => {
    if (!addingRole) return;
    const { error } = await supabase.from("user_roles").insert({
      user_id: addingRole.userId,
      role: addingRole.role as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Role adicionada");
    setAddingRole(null);
    loadAll();
  };

  const getRoles = (userId: string) => roles.filter(r => r.user_id === userId);

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-80">
          <CardHeader><CardTitle className="text-center flex items-center justify-center gap-2"><Shield className="h-5 w-5" /> Área do Desenvolvedor</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="password" placeholder="Senha" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <Button className="w-full" onClick={handleLogin}>Entrar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { label: "Participantes", count: counts.participantes || 0, icon: Users },
    { label: "Turmas", count: counts.turmas || 0, icon: BookOpen },
    { label: "Presenças", count: counts.presenca || 0, icon: ClipboardList },
    { label: "Relatórios", count: counts.relatorios || 0, icon: FileText },
    { label: "Planejamentos", count: counts.planejamentos || 0, icon: FileText },
    { label: "Pontos Transporte", count: counts.pontos || 0, icon: Bus },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield className="h-5 w-5" /> Painel do Desenvolvedor</h1>
        <Button variant="outline" size="sm" onClick={() => { sessionStorage.removeItem("dev_auth"); setAuthed(false); }}>Sair</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <s.icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role management */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Gestão de Permissões</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Profissional</TableHead>
                    <TableHead className="text-xs">Cargo</TableHead>
                    <TableHead className="text-xs">Roles</TableHead>
                    <TableHead className="text-xs w-48">Adicionar Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map(p => {
                    const userRoles = getRoles(p.user_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm font-medium">{p.nome}<br /><span className="text-[10px] text-muted-foreground">{p.email}</span></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.cargo || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userRoles.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma</span>}
                            {userRoles.map(r => (
                              <Badge key={r.id} variant="secondary" className="text-[10px] gap-1">
                                {r.role}
                                <button onClick={() => removeRole(r.id)} className="hover:text-destructive"><Trash2 className="h-2.5 w-2.5" /></button>
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Select value={addingRole?.userId === p.user_id ? addingRole.role : ""} onValueChange={v => setAddingRole({ userId: p.user_id, role: v })}>
                              <SelectTrigger className="h-7 text-[10px] w-28"><SelectValue placeholder="Role" /></SelectTrigger>
                              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>)}</SelectContent>
                            </Select>
                            {addingRole?.userId === p.user_id && (
                              <Button size="icon" className="h-7 w-7" onClick={addRole}><Plus className="h-3 w-3" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
