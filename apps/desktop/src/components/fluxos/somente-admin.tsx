import type { ReactNode } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/**
 * Só o admin gerencia fluxos (PERFIS_FLUXOS no servidor, que é quem de fato
 * barra). Aqui só evita mostrar uma tela que responderia 403.
 */
export function SomenteAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (user.perfil !== 'admin') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-50" />
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground max-w-md">
          Somente administradores criam e editam fluxos de trabalho.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
