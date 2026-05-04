import { useQuery } from "@tanstack/react-query";
import { fetchIndicadorTimeline, type IndicadorId } from "@/lib/indicadorTimelineFetchers";

export function useIndicadorTimeline(indicadorId: IndicadorId | null) {
  return useQuery({
    queryKey: ["indicador-timeline", indicadorId],
    queryFn: () => fetchIndicadorTimeline(indicadorId!),
    enabled: !!indicadorId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}