import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2, Scale } from 'lucide-react';

export const Route = createFileRoute('/login')({
  component: LoginComponent,
});

function LoginComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/', replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.auth.login.$post({
        json: { email, password },
      });

      if (res.ok) {
        const data = await res.json();
        login(data.token, data.user);
        navigate({ to: '/' });
      } else {
        const data = await res.json() as any;
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ocorreu um erro de rede. Verifique a conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background relative overflow-hidden p-4">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] -left-[5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-md shadow-premium-lg border-border/40 bg-card/80 backdrop-blur-xl z-10 animate-fade-in-up">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-premium ring-4 ring-primary/10">
            <Scale className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground">SmartLaw</CardTitle>
            <CardDescription className="text-sm font-medium">
              Sua plataforma jurídica moderna e eficiente.
            </CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-6">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300 rounded-xl border-destructive/20 bg-destructive/5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="rounded-xl border-border/50 bg-background/50 h-11 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="grid gap-2.5">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" title="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Senha</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl border-border/50 bg-background/50 h-11 focus:ring-primary/20 transition-all"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-8">
            <Button className="w-full h-11 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all active:scale-[0.98]" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : 'Entrar na conta'}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="absolute bottom-8 text-center w-full z-10">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">
          Powered by SmartLaw Tech &copy; 2026
        </p>
      </div>
    </div>
  );
}
