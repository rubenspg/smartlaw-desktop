import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { 
  Scale, 
  Users, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  Home,
  Settings,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  { name: 'Home', to: '/', icon: Home },
  { name: 'Clientes', to: '/clientes', icon: Users },
  { name: 'Processos', to: '/processos', icon: FileText },
  { name: 'Financeiro', to: '/financeiro', icon: DollarSign },
  { name: 'Insights', to: '/insights', icon: TrendingUp },
  { name: 'Administrativo', to: '/administrativo', icon: Settings },
];

export const Route = createFileRoute('/_dashboard')({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: '/login' });
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-background border-r transition-all duration-300 flex flex-col fixed inset-y-0 z-50",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <Scale className="w-8 h-8 text-primary shrink-0" />
          {isSidebarOpen && <span className="ml-3 font-bold text-xl tracking-tight truncate">SmartLaw</span>}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center px-3 py-2 rounded-md transition-colors group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", !isSidebarOpen && "mx-auto")} />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.name}</span>}
                {!isSidebarOpen && isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t shrink-0">
          <button
            onClick={logout}
            className={cn(
              "flex items-center w-full px-3 py-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group",
              !isSidebarOpen && "justify-center"
            )}
            title={!isSidebarOpen ? "Sair" : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="ml-3 font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          isSidebarOpen ? "pl-64" : "pl-20"
        )}
      >
        {/* Header */}
        <header className="h-16 border-b bg-background flex items-center justify-between px-6 sticky top-0 z-40">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md hover:bg-muted transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold leading-none">{user?.nome || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground mt-1">{user?.email || ''}</p>
            </div>
            <button 
              onClick={logout}
              className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
