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
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
// @ts-ignore
import ImageModule from 'docxtemplater-image-module-free';
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
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('smartlaw_server_url') || 'http://localhost:3001');
  
  // Regional Settings (Local State for the form)
  const [localLanguage, setLocalLanguage] = useState<Language>(language);
  const [localCurrency, setLocalCurrency] = useState<Currency>(currency);
  const [timezone, setTimezone] = useState(localStorage.getItem('smartlaw_timezone') || 'America/Sao_Paulo');

  // UI Preferences
  const [sidebarDensity, setSidebarDensity] = useState<'default' | 'compact'>(
    (localStorage.getItem('smartlaw_sidebar_density') as 'default' | 'compact') || 'default'
  );

  // Automation Settings
  const [notifyDeadlines, setNotifyDeadlines] = useState(true);
  const [syncCalendar, setSyncCalendar] = useState(false);

  // Templates Mock State
  const [templates] = useState([
    { id: 1, name: 'Procuração Ad Judicia', type: 'DOCX', lastUsed: '2024-05-01' },
    { id: 2, name: 'Contrato de Honorários', type: 'PDF', lastUsed: '2024-04-28' },
  ]);

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
    mutationFn: async ({ nome, logo }: { nome: string, logo: string | null }) => {
      console.log('Enviando atualização do escritório...', { nome, logoLength: logo?.length });
      const res = await api.firms.me.$patch({ json: { nome, logo } });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        console.error('Falha na resposta do servidor:', errorData);
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

  const handleGenerateTemplate = async (templateName: string) => {
    try {
      const response = await fetch('/templates/base.docx');
      if (!response.ok) {
        throw new Error('O arquivo "base.docx" não foi encontrado na pasta "apps/desktop/public/templates/". Por favor, crie um documento Word com este nome e coloque-o lá para que a geração funcione.');
      }
      
      const content = await response.arrayBuffer();
      if (content.byteLength === 0) {
        throw new Error('O arquivo "base.docx" está vazio. Por favor, adicione conteúdo ao template.');
      }

      let zip;
      try {
        zip = new PizZip(content);
      } catch (e) {
        throw new Error('O arquivo "base.docx" não é um documento Word válido (formato ZIP corrompido). Certifique-se de salvar um arquivo .docx real.');
      }
      
      const imageModule = new ImageModule({
        centered: false,
        getImage: (tagValue: string) => {
          const base64Data = tagValue.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        },
        getSize: () => [120, 120], // Fixed size for logo
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.setData({
        nomeEscritorio: firmName,
        logo: firmLogo || '', // Tag {%%logo} in DOCX
        data: new Date().toLocaleDateString('pt-BR'),
        templateName: templateName
      });

      doc.render();
      const out = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      saveAs(out, `${templateName.replace(/\s+/g, '_')}_${new Date().getTime()}.docx`);
    } catch (error: any) {
      console.error(error);
      alert(`Erro ao gerar documento: ${error.message}`);
    }
  };
  
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
      const res = await api.usuarios[':id'].$patch({
        param: { id: user?.id || '' },
        json: {
          nome: profileName,
          email: profileEmail,
          senha: newPassword || undefined,
        }
      });

      if (res.ok) {
        alert('Perfil atualizado com sucesso!');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json() as any;
        alert(`Erro: ${err.error || 'Falha ao atualizar'}`);
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao conectar com o servidor.');
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
          <TabsTrigger value="modelos" className="flex items-center gap-2">
            <FileCode className="w-4 h-4" /> Modelos
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

        <TabsContent value="modelos" className="space-y-4 mt-0">
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Templates de Documentos</h2>
              <p className="text-sm text-muted-foreground">Gerencie seus modelos de petições e contratos.</p>
            </div>
            <Button variant="secondary" className="gap-2">
              <Plus className="w-4 h-4" /> Novo Modelo
            </Button>
          </div>
          
          <div className="grid gap-4">
            {templates.map(tpl => (
              <Card 
                key={tpl.id} 
                onClick={() => handleGenerateTemplate(tpl.name)}
                className="hover:border-primary/50 transition-all cursor-pointer group shadow-none hover:shadow-md"
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <FileIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">Formato {tpl.type} • Último uso: {tpl.lastUsed}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                <Building2 className="w-5 h-5 text-primary" /> Dados do Escritório
              </CardTitle>
              <CardDescription>
                Estas informações aparecerão nos relatórios e documentos gerados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="firm-name">Nome do Escritório</Label>
                <Input 
                  id="firm-name" 
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  disabled={isLoadingFirm || user?.perfil !== 'admin'}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo do Escritório</Label>
                <input 
                  type="file" 
                  id="logo-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleLogoChange}
                  disabled={isLoadingFirm || user?.perfil !== 'admin'}
                />
                <div 
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  className="border-2 border-dashed rounded-xl p-8 text-center border-border/50 hover:border-primary/50 transition-colors cursor-pointer bg-muted/10 relative overflow-hidden flex flex-col items-center justify-center min-h-[200px]"
                >
                  {firmLogo ? (
                    <div className="relative group w-full h-full flex items-center justify-center">
                      <img src={firmLogo} alt="Logo do Escritório" className="max-h-40 object-contain" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                        <p className="text-white text-xs font-bold">Clique para alterar</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Building2 className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-50" />
                      <p className="text-sm font-medium text-foreground">Clique para selecionar uma imagem</p>
                      <p className="text-xs text-muted-foreground mt-2">PNG, JPG até 2MB (Recomendado 400x400px)</p>
                    </>
                  )}
                </div>
              </div>
              <Button 
                onClick={() => updateFirm.mutate({ nome: firmName, logo: firmLogo })} 
                disabled={updateFirm.isPending || user?.perfil !== 'admin'}
                className="gap-2 px-8"
              >
                {updateFirm.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Dados Corporativos
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
              
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Densidade da Barra Lateral</Label>
                  <p className="text-sm text-muted-foreground">Escolha o estilo da navegação lateral.</p>
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                  <Button 
                    variant={sidebarDensity === 'default' ? 'default' : 'ghost'} 
                    size="sm"
                    className="h-8 shadow-none px-4"
                    onClick={() => setSidebarDensity('default')}
                  >
                    Padrão
                  </Button>
                  <Button 
                    variant={sidebarDensity === 'compact' ? 'default' : 'ghost'} 
                    size="sm"
                    className="h-8 shadow-none px-4"
                    onClick={() => setSidebarDensity('compact')}
                  >
                    Compacto
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
