import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  Search,
  History,
  Eye,
  Calendar,
  Database,
} from 'lucide-react';
import type { UsuarioInput, AuditLog, Usuario } from '@smartlaw/shared';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  useUsuarios,
  useCreateUsuario,
  useUpdateUsuario,
  useDeleteUsuario,
} from '@/hooks/use-usuarios';
import { useAuditLogs } from '@/hooks/use-audit-logs';

export const Route = createFileRoute('/_dashboard/administrativo/')({
  component: AdministrativoPage,
});

type Tab = 'usuarios' | 'auditoria';

function AdministrativoPage() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'admin';

  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  const { data: usuarios, isLoading: loadingUsers } = useUsuarios();
  const { data: auditLogs, isLoading: loadingLogs, refetch: refetchLogs } = useAuditLogs({
    enabled: isAdmin && activeTab === 'auditoria',
  });

  const createUsuario = useCreateUsuario();
  const updateUsuario = useUpdateUsuario();
  const deleteUsuario = useDeleteUsuario();

  if (!user) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-[#64748b]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 space-y-4">
        <ShieldAlert className="w-16 h-16 text-[#dc2626] opacity-50" />
        <h1 className="text-2xl font-bold text-[#1e293b]">Acesso Negado</h1>
        <p className="text-[#64748b] max-w-md">
          Você não tem permissão de administrador para acessar esta área.
        </p>
      </div>
    );
  }

  const filteredUsuarios = (usuarios ?? []).filter(
    (u) =>
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredLogs = (auditLogs ?? []).filter(
    (log) =>
      log.tableName?.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(logSearchTerm.toLowerCase()) ||
      log.usuario?.nome?.toLowerCase().includes(logSearchTerm.toLowerCase()),
  );

  const handleToggleStatus = async (u: Usuario) => {
    try {
      await updateUsuario.mutateAsync({ id: u.id, data: { ativo: !u.ativo } });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover permanentemente este usuário?')) return;
    try {
      await deleteUsuario.mutateAsync(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#1e293b]">Administrativo</h1>
          <p className="text-[#64748b] mt-1 text-lg">
            Gestão de usuários e auditoria do sistema.
          </p>
        </div>
        {activeTab === 'usuarios' && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-[#2563eb] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#1d4ed8] shadow-lg shadow-blue-200 transition-all uppercase tracking-wide"
          >
            <UserPlus className="w-5 h-5" /> Novo Usuário
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 bg-[#f1f5f9] p-1.5 rounded-xl w-fit border border-[#e2e8f0]">
        <button
          onClick={() => setActiveTab('usuarios')}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-bold transition-all',
            activeTab === 'usuarios'
              ? 'bg-white shadow-sm text-[#2563eb]'
              : 'text-[#64748b] hover:text-[#1e293b]',
          )}
        >
          <Users className="w-4 h-4 mr-2 inline" /> USUÁRIOS
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={cn(
            'px-6 py-2 rounded-lg text-sm font-bold transition-all',
            activeTab === 'auditoria'
              ? 'bg-white shadow-sm text-[#2563eb]'
              : 'text-[#64748b] hover:text-[#1e293b]',
          )}
        >
          <History className="w-4 h-4 mr-2 inline" /> AUDITORIA
        </button>
      </div>

      {activeTab === 'usuarios' ? (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-300">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-[#f1f5f9] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#f1f5f9] bg-[#f8fafc] flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
                  <input
                    type="text"
                    placeholder="Buscar usuário por nome ou e-mail..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="divide-y divide-[#f1f5f9]">
                {loadingUsers ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563eb]" />
                  </div>
                ) : filteredUsuarios.length === 0 ? (
                  <div className="p-12 text-center text-[#94a3b8] italic">
                    Nenhum usuário encontrado.
                  </div>
                ) : (
                  filteredUsuarios.map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        'p-4 flex items-center justify-between hover:bg-[#f8fafc] transition-colors',
                        !u.ativo && 'opacity-60',
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                            u.perfil === 'admin'
                              ? 'bg-[#eff6ff] text-[#2563eb] border-2 border-[#dbeafe]'
                              : u.perfil === 'secretaria'
                                ? 'bg-[#fffbeb] text-[#d97706] border-2 border-[#fef3c7]'
                                : 'bg-[#f1f5f9] text-[#64748b]',
                          )}
                        >
                          {u.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-[#1e293b]">{u.nome}</p>
                            {u.id === user.id && (
                              <span className="text-[10px] bg-[#dcfce7] text-[#166534] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1',
                                u.perfil === 'admin'
                                  ? 'bg-[#e0e7ff] text-[#4338ca]'
                                  : u.perfil === 'secretaria'
                                    ? 'bg-[#fef3c7] text-[#92400e]'
                                    : 'bg-[#ecfdf5] text-[#047857]',
                              )}
                            >
                              {u.perfil === 'admin' ? (
                                <ShieldCheck className="w-3 h-3" />
                              ) : u.perfil === 'secretaria' ? (
                                <Shield className="w-3 h-3" />
                              ) : (
                                <UserIcon className="w-3 h-3" />
                              )}
                              {u.perfil}
                            </span>
                            <span className="text-xs text-[#94a3b8] truncate max-w-[180px]">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={u.id === user.id}
                          className={cn(
                            'p-2 rounded-lg transition-colors disabled:opacity-30',
                            u.ativo
                              ? 'text-[#059669] hover:bg-[#ecfdf5]'
                              : 'text-[#dc2626] hover:bg-[#fef2f2]',
                          )}
                          title={u.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {u.ativo ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={u.id === user.id}
                          className="p-2 rounded-lg text-[#64748b] hover:bg-[#fef2f2] hover:text-[#dc2626] transition-colors disabled:opacity-30"
                          title="Remover usuário"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 bg-[#eef2ff] rounded-2xl border border-[#e0e7ff] space-y-4">
              <h3 className="font-bold text-[#312e81] flex items-center gap-2">
                <Shield className="w-5 h-5" /> Regras de Perfis
              </h3>
              <div className="space-y-3">
                <div className="text-xs">
                  <p className="font-bold text-[#3730a3] uppercase tracking-widest mb-1 text-[9px]">
                    Administrador
                  </p>
                  <p className="text-[#4338ca]">
                    Acesso total ao sistema: financeiro, configurações e gestão de usuários.
                  </p>
                </div>
                <div className="text-xs">
                  <p className="font-bold text-[#92400e] uppercase tracking-widest mb-1 text-[9px]">
                    Secretaria
                  </p>
                  <p className="text-[#b45309]">
                    Gestão de clientes, processos, tarefas e financeiro operacional. Sem gestão de usuários.
                  </p>
                </div>
                <div className="text-xs">
                  <p className="font-bold text-[#047857] uppercase tracking-widest mb-1 text-[9px]">
                    Usuário
                  </p>
                  <p className="text-[#059669]">
                    Acesso limitado a processos e tarefas atribuídas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl border border-[#f1f5f9] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#f1f5f9] bg-[#f8fafc] flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Filtrar por tabela, ação ou usuário..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#e2e8f0] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2563eb]/20"
                  value={logSearchTerm}
                  onChange={(e) => setLogSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => refetchLogs()}
                className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors"
                title="Atualizar logs"
              >
                <History
                  className={cn('w-5 h-5 text-[#64748b]', loadingLogs && 'animate-spin')}
                />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] text-[10px] font-black uppercase tracking-wider text-[#94a3b8] border-b border-[#f1f5f9]">
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Ação</th>
                    <th className="px-4 py-3">Tabela</th>
                    <th className="px-4 py-3">ID Registro</th>
                    <th className="px-4 py-3 text-right">Dados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563eb]" />
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-[#94a3b8] italic">
                        Nenhum log de auditoria registrado.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-[#f8fafc] transition-colors text-xs"
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap text-[#1e293b]">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-[#94a3b8]" />
                            {log.createdAt
                              ? new Date(log.createdAt).toLocaleString('pt-BR')
                              : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3 h-3 text-[#94a3b8]" />
                            <span className="truncate max-w-[140px]">
                              {log.usuario?.nome ?? 'Sistema / Automático'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'font-black px-2 py-0.5 rounded text-[9px] uppercase',
                              log.action === 'INSERT' && 'bg-[#dcfce7] text-[#166534]',
                              log.action === 'UPDATE' && 'bg-[#dbeafe] text-[#1e40af]',
                              log.action === 'DELETE' && 'bg-[#fee2e2] text-[#991b1b]',
                            )}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-[#64748b] uppercase">
                          {log.tableName}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-[#64748b]">
                          {log.recordId}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 hover:bg-[#eff6ff] text-[#2563eb] rounded-lg transition-all"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <AuditDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {showAddForm && (
        <NovoUsuarioDialog
          onClose={() => setShowAddForm(false)}
          onSubmit={async (data) => {
            try {
              await createUsuario.mutateAsync(data);
              setShowAddForm(false);
            } catch (err: any) {
              alert(err.message);
            }
          }}
          isSubmitting={createUsuario.isPending}
        />
      )}
    </div>
  );
}

function AuditDetailDialog({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#eff6ff] rounded-lg">
              <Database className="w-5 h-5 text-[#2563eb]" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-[#1e293b]">
                Detalhes da Auditoria
              </h2>
              <p className="text-xs text-[#94a3b8]">ID do Log: {log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#f1f5f9] rounded-full transition-colors"
          >
            <XCircle className="w-6 h-6 text-[#64748b]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-[#64748b] tracking-widest border-b border-[#f1f5f9] pb-2">
              Antes (Dados Antigos)
            </h3>
            <div className="bg-[#f1f5f9] p-4 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre-wrap text-[#1e293b]">
              {log.oldData
                ? JSON.stringify(log.oldData, null, 2)
                : 'Nenhum dado anterior (INSERT)'}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-[#2563eb] tracking-widest border-b border-[#f1f5f9] pb-2">
              Depois (Dados Novos)
            </h3>
            <div className="bg-[#eff6ff] p-4 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre-wrap text-[#1e293b]">
              {log.newData
                ? JSON.stringify(log.newData, null, 2)
                : 'Nenhum dado novo (DELETE)'}
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#f8fafc] border-t border-[#f1f5f9] flex justify-between items-center">
          <div className="text-[10px] text-[#64748b] space-y-1">
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
            className="px-6 py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] rounded-xl text-sm font-bold transition-all text-[#1e293b]"
          >
            FECHAR
          </button>
        </div>
      </div>
    </div>
  );
}

function NovoUsuarioDialog({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (data: UsuarioInput) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<UsuarioInput>({
    nome: '',
    email: '',
    senha: '',
    perfil: 'usuario',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-[#f1f5f9] flex items-center justify-between bg-[#f8fafc]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-[#1e293b]">
            <UserPlus className="w-5 h-5 text-[#2563eb]" /> Novo Usuário
          </h2>
          <button onClick={onClose}>
            <XCircle className="w-6 h-6 text-[#64748b] hover:text-[#1e293b]" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(formData);
          }}
          className="p-6 space-y-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#64748b] uppercase">Nome Completo</label>
            <input
              type="text"
              className="w-full p-2 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#2563eb] outline-none"
              placeholder="Ex: João Silva"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#64748b] uppercase">E-mail</label>
            <input
              type="email"
              className="w-full p-2 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#2563eb] outline-none"
              placeholder="joao@smartlaw.com"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#64748b] uppercase">Senha Inicial</label>
            <input
              type="password"
              className="w-full p-2 border border-[#e2e8f0] rounded-lg focus:ring-2 focus:ring-[#2563eb] outline-none"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#64748b] uppercase">Cargo / Perfil</label>
            <select
              className="w-full p-2 border border-[#e2e8f0] rounded-lg outline-none bg-white"
              value={formData.perfil}
              onChange={(e) =>
                setFormData({ ...formData, perfil: e.target.value as 'admin' | 'usuario' | 'secretaria' })
              }
            >
              <option value="usuario">Usuário</option>
              <option value="secretaria">Secretaria</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#2563eb] text-white font-bold rounded-lg hover:bg-[#1d4ed8] shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CRIAR USUÁRIO'}
          </button>
        </form>
      </div>
    </div>
  );
}
