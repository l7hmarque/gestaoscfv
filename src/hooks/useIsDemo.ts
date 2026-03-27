import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useIsDemo(): boolean {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["is-demo", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "visitante" as any);
      return (data && data.length > 0) ?? false;
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  return data ?? false;
}

/** Returns true (blocked) if demo mode — call at the top of write handlers */
export function guardDemo(isDemo: boolean): boolean {
  if (isDemo) {
    toast.info("Modo demonstração — alterações não são salvas");
    return true;
  }
  return false;
}
