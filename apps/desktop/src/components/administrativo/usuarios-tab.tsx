import { useState } from 'react';
import { Search, Loader2, ShieldCheck, Shield, User as UserIcon, Pencil, Trash2 } from 'lucide-react';
import type { Usuario } from '@/lib/entities';
import { cn } from '@/lib/utils';

interface UsuariosTabProps {
  usuarios: Usuario[] | undefined;
  isLoading: boolean;
  currentUserId: string;
  onEdit: (u: Usuario) => void;
  onDelete: (id: string) => void;
}

export function UsuariosTab({ usuarios, isLoading, currentUserId, onEdit, onDelete }: UsuariosTabProps) {
  const [search, setSearch] = useState('');

  const filtered = (usuarios ?? []).filter(
    (u) =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-300">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar usuário por nome ou e-mail..."
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic">
                Nenhum usuário encontrado.
              </div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className={cn(
                    'p-4 flex items-center justify-between hover:bg-muted/20 transition-colors',
                    !u.ativo && 'opacity-60',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                        u.perfil === 'admin'
                          ? 'bg-primary/10 text-primary border-2 border-primary/20'
                          : u.perfil === 'administrativo'
                            ? 'bg-amber-500/10 text-amber-500 border-2 border-amber-500/20'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {u.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground">{u.nome}</p>
                        {u.id === currentUserId && (
                          <span className="text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1',
                            u.perfil === 'admin'
                              ? 'bg-primary/10 text-primary'
                              : u.perfil === 'administrativo'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-green-500/10 text-green-500',
                          )}
                        >
                          {u.perfil === 'admin' ? (
                            <ShieldCheck className="w-3 h-3" />
                          ) : u.perfil === 'administrativo' ? (
                            <Shield className="w-3 h-3" />
                          ) : (
                            <UserIcon className="w-3 h-3" />
                          )}
                          {u.perfil}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {u.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(u)}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      title="Editar usuário"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onDelete(u.id)}
                      disabled={u.id === currentUserId}
                      className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30"
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
        <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
          <h3 className="font-bold text-primary flex items-center gap-2">
            <Shield className="w-5 h-5" /> Regras de Perfis
          </h3>
          <div className="space-y-3">
            <div className="text-xs">
              <p className="font-bold text-primary uppercase tracking-widest mb-1 text-[9px]">Administrador</p>
              <p className="text-muted-foreground">Acesso total ao sistema: financeiro, configurações e gestão de usuários.</p>
            </div>
            <div className="text-xs">
              <p className="font-bold text-amber-500 uppercase tracking-widest mb-1 text-[9px]">Administrativo</p>
              <p className="text-muted-foreground">Gestão de clientes, processos, tarefas e financeiro operacional. Sem gestão de usuários.</p>
            </div>
            <div className="text-xs">
              <p className="font-bold text-blue-500 uppercase tracking-widest mb-1 text-[9px]">Secretaria</p>
              <p className="text-muted-foreground">Acesso operacional: Clientes e Processos. Sem financeiro e sem gestão de usuários.</p>
            </div>
            <div className="text-xs">
              <p className="font-bold text-green-500 uppercase tracking-widest mb-1 text-[9px]">Usuário</p>
              <p className="text-muted-foreground">Acesso limitado a processos e tarefas atribuídas.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
