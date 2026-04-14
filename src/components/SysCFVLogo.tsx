interface SysCFVLogoProps {
  collapsed?: boolean;
  size?: "sm" | "md";
}

export function SysCFVLogo({ collapsed = false, size = "md" }: SysCFVLogoProps) {
  const iconSize = size === "sm" ? 28 : 34;

  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Hexagonal shield shape */}
        <path
          d="M20 2L36 11V29L20 38L4 29V11L20 2Z"
          fill="hsl(var(--primary))"
          stroke="hsl(var(--primary))"
          strokeWidth="1"
        />
        {/* Inner angular arrow — "forward motion" */}
        <path
          d="M14 15L22 20L14 25V15Z"
          fill="hsl(var(--primary-foreground))"
        />
        <path
          d="M19 15L27 20L19 25V15Z"
          fill="hsl(var(--primary-foreground))"
          fillOpacity="0.6"
        />
        {/* Horizontal bar — stability */}
        <rect
          x="12"
          y="28"
          width="16"
          height="2"
          rx="1"
          fill="hsl(var(--primary-foreground))"
          fillOpacity="0.5"
        />
      </svg>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="font-bold text-sm tracking-tight text-sidebar-foreground">
            SysCFV
          </span>
          <span className="text-[9px] text-muted-foreground tracking-wider uppercase">
            Gestão SCFV
          </span>
        </div>
      )}
    </div>
  );
}
