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
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Outer geometric shape — rounded square/shield */}
        <rect
          x="2" y="2" width="44" height="44" rx="10"
          fill="hsl(var(--primary))"
        />

        {/* Inner letters S-C-V arranged so their curves form a heart shape */}
        {/* S — left side, its curves form the left lobe of the heart */}
        <path
          d="M13 14 C17 11, 21 13, 20 16 C19 19, 14 19, 13 22 C12 25, 15 28, 19 28"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* C — right side, its arc forms the right lobe of the heart */}
        <path
          d="M35 14 C31 11, 27 13, 28 16 C29 19, 34 19, 35 22 C36 25, 33 28, 29 28"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* V — bottom center, the two strokes meet at a point forming the heart's bottom tip */}
        <path
          d="M19 28 L24 38 L29 28"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
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
