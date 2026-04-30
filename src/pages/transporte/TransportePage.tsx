import DashboardTransporteTab from "@/pages/dashboard/DashboardTransporteTab";
import { Bus } from "lucide-react";

export default function TransportePage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-[1400px]">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Bus className="h-5 w-5 text-primary" /> Transporte
        </h1>
        <p className="text-xs text-muted-foreground">Pontos, embarques e relatório diário</p>
      </div>
      <DashboardTransporteTab />
    </div>
  );
}
