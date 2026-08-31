import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { 
  Settings, 
  Globe, 
  User, 
  Building2, 
  Moon, 
  Sun, 
  Layout, 
  Save,
  Lock,
  Loader2,
  FileCode,
  BellRing,
  CalendarDays,
  Bot,
  Plus,
  FileText as FileIcon,
  Trash2,
  DollarSign,
  Shield,
  Languages,
  Clock,
  Coins,
  Info,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/theme-provider';
import { useRegional, type Language, type Currency } from '@/components/regional-provider';

export const Route = createFileRoute('/_dashboard/settings/')({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { 
    language, 
    currency, 
    setLanguage: setGlobalLanguage, 
    setCurrency: setGlobalCurrency,
    t
  } = useRegional();
  const queryClient = useQueryClient();
  
  // Connection Settings
  const [serverUrl, setServerUrl] = useState(() => {
    const saved = localStorage.getItem('smartlaw_server_url');
    if (saved) return saved;
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  });
  
  // Regional Settings (Local State for the form)
  const [localLanguage, setLocalLanguage] = useState<Language>(language);
  const [localCurrency, setLocalCurrency] = useState<Currency>(currency);
  const [timezone, setTimezone] = useState(localStorage.getItem('smartlaw_timezone') || 'America/Sao_Paulo');

  // Automation Settings
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [syncCalendar, setSyncCalendar] = useState(false);

  // User Profile
  const [profileName, setProfileName] = useState(user?.nome || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Firm Settings
  const { data: firm, isLoading: isLoadingFirm } = useQuery({
    queryKey: ['firm'],
    queryFn: async () => {
      const res = await api.firms.me.$get();
      if (!res.ok) throw new Error('Falha ao carregar dados do escritório');
      return res.json();
    }
  });

  const [firmName, setFirmName] = useState('');
  const [firmLogo, setFirmLogo] = useState<string | null>(null);
  const [datajudApiKey, setDatajudApiKey] = useState('');

  // A chave do Datajud nunca volta do servidor — só a informação de que existe.
  const hasDatajudKey = Boolean(firm && 'hasDatajudKey' in firm && firm.hasDatajudKey);

  useEffect(() => {
    if (firm && 'nome' in firm) {
      setFirmName(firm.nome);
      setFirmLogo(firm.logo || null);
    }
  }, [firm]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem é muito grande! O limite é 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFirmLogo(reader.result as string);
      };
      reader.onerror = () => {
        alert('Erro ao ler o arquivo da imagem.');
      };
      reader.readAsDataURL(file);
    }
  };

  const updateFirm = useMutation({
    mutationFn: async ({ nome, logo, datajudApiKey }: { nome: string, logo: string | null, datajudApiKey: string }) => {
      const res = await api.firms.me.$patch({ json: { nome, logo, datajudApiKey } });
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({ error: 'Erro desconhecido' }))) as any;
        throw new Error(errorData.error || 'Falha ao atualizar escritório');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm'] });
      alert('Dados do escritório atualizados com sucesso!');
    },
    onError: (err: any) => {
      console.error('Erro na mutação updateFirm:', err);
      alert(`Erro: ${err.message}`);
    }
  });
  
  const handleSaveGeneral = () => {
    const oldServerUrl = localStorage.getItem('smartlaw_server_url') || 'http://localhost:3001';
    
    localStorage.setItem('smartlaw_server_url', serverUrl);
    setGlobalLanguage(localLanguage);
    setGlobalCurrency(localCurrency);
    localStorage.setItem('smartlaw_timezone', timezone);
    
    alert('Configurações gerais salvas!');
    
    if (serverUrl !== oldServerUrl) {
      window.location.reload();
    }
  };

  const handleSaveProfile = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }

    try {
      const payload: any = {
        nome: profileName,
        email: profileEmail,
      };

      if (newPassword && newPassword.trim() !== "") {
        payload.senha = newPassword;
      }

      // Use the new "me" endpoint which doesn't require admin role
      const res = await (api.usuarios as any).me.$patch({
        json: payload
      });

      if (res.ok) {
        alert('Perfil atualizado com sucesso!');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        let errorMessage = 'Falha ao atualizar';
        try {
          const err = await res.json() as any;
          errorMessage = err.error || errorMessage;
        } catch (e) {
          const text = await res.text().catch(() => '');
          errorMessage = `Erro ${res.status}: ${text || 'Resposta inválida do servidor'}`;
        }
        alert(`Erro: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Erro de conexão:', error);
      alert('Erro ao conectar com o servidor. Verifique sua internet e a URL do servidor nas configurações.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate({ to: '/' })}
            className="rounded-full hover:bg-primary/10 hover:text-primary transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('settings.title')}</h1>
            <p className="text-muted-foreground">{t('settings.description')}</p>
          </div>
        </div>
        <Button onClick={handleSaveGeneral} className="gap-2">
          <Save className="w-4 h-4" /> {t('settings.save_all')}
        </Button>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 lg:w-fit mb-8">
          <TabsTrigger value="geral" className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> {t('settings.general')}
          </TabsTrigger>
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <User className="w-4 h-4" /> {t('settings.profile')}
          </TabsTrigger>
          <TabsTrigger value="escritorio" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" /> {t('settings.firm')}
          </TabsTrigger>
          <TabsTrigger value="aparencia" className="flex items-center gap-2">
            <Layout className="w-4 h-4" /> {t('settings.appearance')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 mt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Languages className="w-5 h-5 text-primary" /> {t('settings.regional')}
                </CardTitle>
                <CardDescription>
                  Configure idioma e preferências de exibição regional.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('settings.language')}</Label>
                  <Select value={localLanguage} onValueChange={(val: Language) => setLocalLanguage(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.currency')}</Label>
                  <Select value={localCurrency} onValueChange={(val: Currency) => setLocalCurrency(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a moeda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real (R$)</SelectItem>
                      <SelectItem value="USD">Dólar ($)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.timezone')}</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fuso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                      <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="w-5 h-5 text-primary" /> {t('settings.system')}
                </CardTitle>
                <CardDescription>
                  Configurações técnicas de conexão com o servidor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">{t('settings.server_url')}</Label>
                  <Input 
                    id="server-url" 
                    placeholder="http://localhost:3001" 
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Alterar a URL requer o reinício da aplicação.
                  </p>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Modo Offline</Label>
                    <p className="text-xs text-muted-foreground">Permitir visualização de dados em cache.</p>
                  </div>
                  <Switch disabled />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="perfil" className="space-y-6 mt-0">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" /> Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize seu nome e endereço de e-mail corporativo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input 
                    id="name" 
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-primary" /> Segurança
              </CardTitle>
              <CardDescription>
                Gerencie sua senha e métodos de autenticação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input 
                    id="new-password" 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input 
                    id="confirm-password" 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} className="gap-2 px-8">
              <Save className="w-4 h-4" /> Salvar Perfil
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="escritorio" className="space-y-4 mt-0">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-primary" /> Configurações de Integração
              </CardTitle>
              <CardDescription>
                Configure as chaves de acesso para busca automática de processos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="datajud-key">Chave API Datajud (CNJ)</Label>
                <div className="relative">
                  <Input 
                    id="datajud-key" 
                    type="password"
                    value={datajudApiKey}
                    onChange={(e) => setDatajudApiKey(e.target.value)}
                    disabled={isLoadingFirm || user?.perfil !== 'admin'}
                    className="bg-muted/30 pr-10"
                    placeholder={hasDatajudKey ? '•••••••• (chave configurada)' : 'APIKey ...'}
                  />
                  <div className="absolute right-3 top-2.5 text-muted-foreground">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  Esta chave é usada para buscar processos automaticamente no tribunal.
                  {hasDatajudKey && ' Deixe em branco para manter a chave atual.'}
                </p>
              </div>

              <Button 
                onClick={() => updateFirm.mutate({ nome: firmName, logo: firmLogo, datajudApiKey })} 
                disabled={updateFirm.isPending || user?.perfil !== 'admin'}
                className="gap-2 px-8"
              >
                {updateFirm.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Chave API
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aparencia" className="space-y-4 mt-0">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layout className="w-5 h-5 text-primary" /> Preferências Visuais
              </CardTitle>
              <CardDescription>
                Personalize como o sistema aparece para você.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Tema do Sistema</Label>
                  <p className="text-sm text-muted-foreground">Alternar entre modo claro e escuro.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                   <Button 
                    variant={theme === 'light' ? 'default' : 'ghost'} 
                    size="sm"
                    className="h-8 shadow-none gap-2 px-4"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="w-4 h-4" /> Claro
                  </Button>
                  <Button 
                    variant={theme === 'dark' ? 'default' : 'ghost'} 
                    size="sm"
                    className="h-8 shadow-none gap-2 px-4"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="w-4 h-4" /> Escuro
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 shadow-sm">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="w-5 h-5 text-primary" /> Sobre o Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Versão</span>
                  <span className="font-mono font-medium">0.1.0-alpha</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Build</span>
                  <span className="font-mono">20240504-1</span>
                </div>
                <Separator className="my-4" />
                <p className="text-xs text-center text-muted-foreground italic">
                  SmartLaw Desktop - Todos os direitos reservados.
                </p>
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
