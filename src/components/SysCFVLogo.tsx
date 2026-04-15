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
        {/* Outer rounded square */}
        <rect
          x="2" y="2" width="44" height="44" rx="10"
          fill="hsl(var(--primary))"
        />

        {/* S — left, vertical with subtle curves */}
        <path
          d="M11 13 C15 13, 17 15, 17 17.5 C17 20, 11 21, 11 24 C11 27, 15 29, 17 29"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* C — center, open arc curving left */}
        <path
          d="M27 13 C21 13, 19 17, 19 21 C19 25, 21 29, 27 29"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* V — right, the two arms meet at a point below = heart tip */}
        <path
          d="M29 13 L33.5 29 L38 13"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Subtle heart accent: small filled heart at bottom center */}
        <path
          d="M24 38 C24 38, 20.5 34, 20.5 32.5 C20.5 31.5, 21.5 31, 22.5 31.5 C23 31.8, 24 33, 24 33 C24 33, 25 31.8, 25.5 31.5 C26.5 31, 27.5 31.5, 27.5 32.5 C27.5 34, 24 38, 24 38Z"
          fill="hsl(var(--primary-foreground))"
          fillOpacity="0.85"
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
