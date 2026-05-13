import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import type { AuthContextType } from "../lib/auth";
import { useRegional } from "../components/regional-provider";
import {
  Scale,
  Users,
  FileText,
  LogOut,
  X,
  Menu,
  Home,
  Settings,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  "Sem status": "Sem status",
};

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth: AuthContextType }).auth;
    if (!auth.isLoading && !auth.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { t } = useRegional();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Carregando...
      </div>
    );
  }
  if (!isAuthenticated) {
    return null;
  }

  const userInitial = user?.nome?.charAt(0).toUpperCase() || "U";

  const menuItems = [
    { name: t("nav.home"), to: "/", icon: Home },
    { name: t("nav.agenda"), to: "/agenda", icon: CalendarDays },
    { name: t("nav.clients"), to: "/clientes", icon: Users },
    { name: t("nav.processes"), to: "/processos", icon: FileText },
    { name: t("nav.finance"), to: "/financeiro", icon: DollarSign },
    { name: t("nav.insights"), to: "/insights", icon: TrendingUp },
    { name: t("nav.admin"), to: "/administrativo", icon: ShieldCheck },
    { name: t("nav.settings"), to: "/settings", icon: Settings },
  ];

  const filteredMenuItems = menuItems.filter((item) => {
    if (user?.perfil === "usuario") {
      return !["/financeiro", "/insights", "/administrativo"].includes(item.to);
    }
    if (user?.perfil === "secretaria") {
      return !["/financeiro", "/insights", "/administrativo"].includes(item.to);
    }
    if (user?.perfil === "administrativo") {
      return !["/administrativo"].includes(item.to);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex text-foreground selection:bg-primary/20">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-card border-r transition-all duration-300 flex flex-col fixed inset-y-0 z-50 shadow-premium",
          isSidebarOpen ? "w-64" : "w-20",
        )}
      >
        <div className="h-16 flex items-center px-6 shrink-0 border-b border-border/50">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0 shadow-sm">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          {isSidebarOpen && (
            <span className="ml-3 font-bold text-lg tracking-tight text-foreground">
              SmartLaw
            </span>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {filteredMenuItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                )}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-transform duration-200",
                    isActive ? "text-primary" : "group-hover:scale-110",
                    !isSidebarOpen && "mx-auto",
                  )}
                />
                {isSidebarOpen && (
                  <span className="ml-3 text-sm">{item.name}</span>
                )}
                {isActive && isSidebarOpen && (
                  <div className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50 shrink-0">
          <button
            onClick={logout}
            className={cn(
              "flex items-center w-full px-4 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 group",
              !isSidebarOpen && "justify-center",
            )}
            title={!isSidebarOpen ? t("nav.logout") : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold shrink-0 group-hover:bg-destructive/20 group-hover:text-destructive">
              {userInitial}
            </div>
            {isSidebarOpen && (
              <span className="ml-3 font-medium text-sm">
                {t("nav.logout")}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          isSidebarOpen ? "pl-64" : "pl-20",
        )}
      >
        {/* Header */}
        <header className="h-16 glass flex items-center justify-between px-6 sticky top-0 z-40 border-b border-border/50 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl hover:bg-accent transition-all text-muted-foreground hover:text-foreground active:scale-95"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="h-4 w-[1px] bg-border/50 mx-1 hidden sm:block" />
            <h2 className="text-sm font-semibold text-foreground hidden sm:block">
              {menuItems.find(
                (i) =>
                  location.pathname === i.to ||
                  (i.to !== "/" && location.pathname.startsWith(i.to)),
              )?.name || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-foreground leading-none">
                {user?.nome || "Admin"}
              </p>
              <p className="text-[10px] text-foreground mt-1 uppercase tracking-wider font-bold">
                {user?.perfil || "Administrador"}
              </p>
            </div>
            <div className="h-8 w-[1px] bg-border/50" />
            <button
              onClick={logout}
              className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all border border-border/50 active:scale-95 shadow-sm"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1 bg-background/50 animate-fade-in-up">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
