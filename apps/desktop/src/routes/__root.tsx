import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: () => (
    <div className="p-4 flex flex-col items-center justify-center min-h-screen text-destructive">
      <h1 className="text-xl font-bold">Ocorreu um erro inesperado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Tente recarregar a página.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-4 flex flex-col items-center justify-center min-h-screen text-muted-foreground">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-sm">A rota solicitada não existe.</p>
    </div>
  ),
});

function RootComponent() {
  return (
    <>
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
      <TanStackRouterDevtools />
    </>
  );
}
