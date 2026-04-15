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
        {/* Geometric heart formed by S-C-V letter strokes */}
        {/* Left curve (S shape flows into heart left) */}
        <path
          d="M24 44 C24 44, 4 32, 4 18 C4 10, 10 4, 18 4 C22 4, 24 7, 24 7"
          stroke="hsl(var(--primary))"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Right curve (mirrored, completing heart) */}
        <path
          d="M24 44 C24 44, 44 32, 44 18 C44 10, 38 4, 30 4 C26 4, 24 7, 24 7"
          stroke="hsl(var(--primary))"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* S stroke — left inner curve */}
        <path
          d="M16 14 C16 14, 20 12, 20 16 C20 20, 14 20, 14 24 C14 28, 20 28, 20 28"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* C stroke — center arc */}
        <path
          d="M28 15 C25 13, 22 15, 22 20 C22 25, 25 27, 28 25"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* V stroke — right chevron */}
        <path
          d="M30 14 L34 26 L38 14"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Small filled heart accent at the center-bottom */}
        <path
          d="M24 36 L22 33 C21 31, 22 30, 24 32 C26 30, 27 31, 26 33 Z"
          fill="hsl(var(--primary))"
          fillOpacity="0.7"
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
