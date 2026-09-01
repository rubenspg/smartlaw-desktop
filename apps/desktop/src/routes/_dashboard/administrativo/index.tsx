import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  XCircle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  History,
  Database,
} from 'lucide-react';
import type { UsuarioInput, UsuarioUpdateInput } from '@smartlaw/shared';
import type { AuditLog, Usuario } from '@/lib/entities';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  useUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useDeleteUsuario,
} from '@/hooks/use-usuarios';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { UsuariosTab } from '@/components/administrativo/usuarios-tab';
import { AuditoriaTable } from '@/components/administrativo/auditoria-table';

export const Route = createFileRoute('/_dashboard/administrativo/')({
  component: AdministrativoPage,
});

type Tab = 'usuarios' | 'auditoria';

function AdministrativoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.perfil === 'admin';

  useEffect(() => {
    if (user && !isAdmin) {
      navigate({ to: '/' });
    }
  }, [user, isAdmin, navigate]);

  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: usuarios, isLoading: loadingUsers } = useUsuarios();
  const { data: auditLogs, isLoading: loadingLogs, refetch: refetchLogs } = useAuditLogs({
    enabled: isAdmin && activeTab === 'auditoria',
  });

  const createUsuario = useCreateUsuario();
  const updateUsuario = useUpdateUsuario();
  const deleteUsuario = useDeleteUsuario();

  if (!user) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <ShieldAlert className="w-16 h-16 text-destructive opacity-50" />
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão de administrador para acessar esta área.
        </p>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    if (!(await confirm({ description: 'Tem certeza que deseja remover permanentemente este usuário?', destructive: true, confirmText: 'Remover' }))) return;
    try {
      await deleteUsuario.mutateAsync(id);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Administrativo</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Gestão de usuários e auditoria do sistema.
          </p>
        </div>
        {activeTab === 'usuarios' && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all uppercase tracking-wide"
          >
            <UserPlus className="w-5 h-5" /> Novo Usuário
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl w-fit border border-border">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-bold transition-all',
            activeTab === 'usuarios'
              ? 'bg-background shadow-sm text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="w-4 h-4 mr-2 inline" /> USUÁRIOS
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-bold transition-all',
            activeTab === 'auditoria'
              ? 'bg-background shadow-sm text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <History className="w-4 h-4 mr-2 inline" /> AUDITORIA
        </button>
      </div>

      {activeTab === 'usuarios' ? (
        <UsuariosTab
          usuarios={usuarios}
          isLoading={loadingUsers}
          currentUserId={user!.id}
          onEdit={setEditingUsuario}
          onDelete={handleDelete}
        />
      ) : (
        <AuditoriaTable
          logs={auditLogs}
          isLoading={loadingLogs}
          onRefresh={() => refetchLogs()}
          onSelect={setSelectedLog}
        />
      )}

      {selectedLog && (
        <AuditDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {showAddForm && (
        <UsuarioFormDialog
          onClose={() => setShowAddForm(false)}
          onSubmit={async (data) => {
            try {
              await createUsuario.mutateAsync(data as UsuarioInput);
              setShowAddForm(false);
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
          isSubmitting={createUsuario.isPending}
        />
      )}

      {editingUsuario && (
        <UsuarioFormDialog
          usuario={editingUsuario}
          onClose={() => setEditingUsuario(null)}
          onSubmit={async (data) => {
            try {
              await updateUsuario.mutateAsync({
                id: editingUsuario.id,
                data: data as UsuarioUpdateInput,
              });
              setEditingUsuario(null);
            } catch (err: any) {
              toast.error(err.message);
            }
          }}
          isSubmitting={updateUsuario.isPending}
        />
      )}
    </div>
  );
}

function AuditDetailDialog({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
      <div className="bg-card w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-foreground">
                Detalhes da Auditoria
              </h2>
              <p className="text-xs text-muted-foreground">ID do Log: {log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted/50 rounded-full transition-colors"
          >
            <XCircle className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest border-b border-border pb-2">
              Antes (Dados Antigos)
            </h3>
            <div className="bg-muted/50 p-4 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre-wrap text-foreground border border-border">
              {log.oldData
                ? JSON.stringify(log.oldData, null, 2)
                : 'Nenhum dado anterior (INSERT)'}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-primary tracking-widest border-b border-border pb-2">
              Depois (Dados Novos)
            </h3>
            <div className="bg-primary/5 p-4 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre-wrap text-foreground border border-primary/10">
              {log.newData
                ? JSON.stringify(log.newData, null, 2)
                : 'Nenhum dado novo (DELETE)'}
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/30 border-t border-border flex justify-between items-center">
          <div className="text-[10px] text-muted-foreground space-y-1">
            <p>
              <strong>Executado por:</strong> {log.usuario?.nome ?? 'Desconhecido'}
            </p>
            <p>
              <strong>Data/Hora:</strong>{' '}
              {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-muted hover:bg-muted/80 rounded-xl text-sm font-bold transition-all text-foreground"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

function UsuarioFormDialog({
  usuario,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  usuario?: Usuario;
  onClose: () => void;
  onSubmit: (data: UsuarioInput | UsuarioUpdateInput) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<{
    nome: string;
    email: string;
    senha: string;
    perfil: 'admin' | 'usuario' | 'administrativo' | 'secretaria';
  }>({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    senha: '',
    perfil: (usuario?.perfil as 'admin' | 'usuario' | 'administrativo' | 'secretaria') ?? 'usuario',
  });

  const isEditing = !!usuario;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            {isEditing ? (
              <>
                <ShieldCheck className="w-5 h-5 text-primary" /> Editar Usuário
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 text-primary" /> Novo Usuário
              </>
            )}
          </h2>
          <button onClick={onClose}>
            <XCircle className="w-6 h-6 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const submitData: any = { ...formData };
            
            // Na edição, se a senha estiver vazia, removemos do payload para não sobrescrever
            if (isEditing && (!submitData.senha || submitData.senha.trim() === "")) {
              delete submitData.senha;
            }
            
            onSubmit(submitData);
          }}
          className="p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Nome Completo</label>
            <input
              type="text"
              className="w-full p-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
              placeholder="Ex: João Silva"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">E-mail</label>
            <input
              type="email"
              className="w-full p-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
              placeholder="joao@smartlaw.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">
              {isEditing ? 'Alterar Senha' : 'Senha Inicial'}
            </label>
            <input
              type="password"
              className="w-full p-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
              placeholder={isEditing ? 'Deixe vazio para manter a atual' : 'Mínimo 6 caracteres'}
              required={!isEditing}
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
            />
            {isEditing && (
              <p className="text-[10px] text-muted-foreground italic">
                * Preencha apenas se desejar alterar a senha deste usuário.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Cargo / Perfil</label>
            <select
              className="w-full p-2 bg-background border border-border rounded-lg outline-none text-foreground"
              value={formData.perfil}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  perfil: e.target.value as 'admin' | 'usuario' | 'administrativo' | 'secretaria',
                })
              }
            >
              <option value="usuario">Usuário</option>
              <option value="secretaria">Secretaria</option>
              <option value="administrativo">Administrativo</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isEditing ? (
              'SALVAR ALTERAÇÕES'
            ) : (
              'CRIAR USUÁRIO'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
