import { Link, Outlet, useLocation } from "react-router-dom";
import scnsaLogo from "@/assets/scnsa-logo.png";
import caiaLogo from "@/assets/caia-logo.png";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { to: "/site", label: "Início" },
  { to: "/site/indicadores", label: "Indicadores" },
  { to: "/site/noticias", label: "Notícias" },
  { to: "/site/conteudos", label: "Conteúdos" },
  { to: "/site/contato", label: "Contato" },
];

export default function SiteLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/site" className="flex items-center gap-3 shrink-0">
              <img src={scnsaLogo} alt="SCNSA" className="h-10 md:h-14 w-auto" />
              <div className="hidden sm:block h-8 w-px bg-gray-300" />
              <img src={caiaLogo} alt="CAIA" className="hidden sm:block h-9 md:h-12 w-auto" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === l.to
                      ? "bg-[#E5541B]/10 text-[#E5541B]"
                      : "text-gray-600 hover:text-[#E5541B] hover:bg-gray-50"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            {/* Mobile toggle */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-600">
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile nav */}
          {menuOpen && (
            <nav className="md:hidden pb-4 flex flex-col gap-1">
              {navLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium",
                    location.pathname === l.to
                      ? "bg-[#E5541B]/10 text-[#E5541B]"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={scnsaLogo} alt="SCNSA" className="h-12 w-auto brightness-0 invert" />
              </div>
              <p className="text-sm leading-relaxed">
                Sociedade Civil Nossa Senhora Aparecida
              </p>
              <p className="text-xs mt-2 text-gray-500">
                CNPJ: 78.114.798/0001-03
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Navegação</h4>
              <ul className="space-y-2 text-sm">
                {navLinks.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="hover:text-[#E5541B] transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Contato</h4>
              <p className="text-sm">Medianeira — PR, Brasil</p>
              <p className="text-sm mt-1">contato@scnsa.org.br</p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Sociedade Civil Nossa Senhora Aparecida. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
