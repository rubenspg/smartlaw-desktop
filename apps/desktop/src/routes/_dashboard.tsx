import { createFileRoute, Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { 
  Scale, 
  Users, 
  FileText, 
  LogOut, 
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
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  const userInitial = user?.nome?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r transition-all duration-300 flex flex-col fixed inset-y-0 z-50 shadow-sm",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="h-16 flex items-center px-6 shrink-0">
          <Scale className="w-8 h-8 text-[#2563eb] shrink-0" />
          {isSidebarOpen && <span className="ml-3 font-bold text-xl tracking-tight text-[#1e293b]">SmartLaw</span>}
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center px-4 py-3 rounded-lg transition-all duration-200 group relative",
                  isActive 
                    ? "bg-[#2563eb] text-white shadow-md shadow-blue-200" 
                    : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b]"
                )}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", !isSidebarOpen && "mx-auto")} />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t shrink-0">
          <button
            onClick={logout}
            className={cn(
              "flex items-center w-full px-4 py-3 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1e293b] transition-all duration-200 group",
              !isSidebarOpen && "justify-center"
            )}
            title={!isSidebarOpen ? "Sair" : undefined}
          >
            <div className="w-8 h-8 rounded-full bg-[#334155] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {userInitial}
            </div>
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
        <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md hover:bg-[#f1f5f9] transition-colors text-[#64748b]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#1e293b] leading-none">{user?.nome || 'admin'}</p>
              <p className="text-xs text-[#64748b] mt-1">{user?.email || 'admin@smartlaw.com'}</p>
            </div>
            <button 
              onClick={logout}
              className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center text-[#2563eb] hover:bg-[#e2e8f0] transition-colors border border-[#e2e8f0]"
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
