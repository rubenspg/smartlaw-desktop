import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '../../lib/auth';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_dashboard/')({
  component: HomeComponent,
});

function HomeComponent() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Bem-vindo, {user?.nome}!</h1>
      <p className="text-muted-foreground">
        Você está acessando o Escritório SmartLaw.
      </p>
      <Button onClick={logout}>Sair</Button>
    </div>
  );
}
