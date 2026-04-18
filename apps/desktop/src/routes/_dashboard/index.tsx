import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  Clock, 
  ExternalLink, 
  Calendar, 
  Plus, 
  ClipboardCheck,
  CheckCircle2,
  MoreVertical,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTarefas, useCreateTarefa, useUpdateTarefa, useDeleteTarefa } from '@/hooks/use-tarefas';
import { TarefaForm } from '@/components/shared/tarefa-form';
import { Tarefa, TarefaInput } from '@smartlaw/shared';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_dashboard/')({
  component: HomeComponent,
});

// ... andamentos const remains same ...

function HomeComponent() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | undefined>(undefined);
  
  const { data: tarefas, isLoading: isLoadingTarefas } = useTarefas();
  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa(editingTarefa?.id || 0);
  const deleteTarefa = useDeleteTarefa();

  const handleCreate = () => {
    setEditingTarefa(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta tarefa?')) {
      await deleteTarefa.mutateAsync(id);
    }
  };

  const toggleStatus = async (tarefa: Tarefa) => {
    const newStatus = tarefa.status === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA';
    await updateTarefa.mutateAsync({
      usuarioId: tarefa.usuarioId,
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      dataLimite: tarefa.dataLimite,
      prioridade: tarefa.prioridade as any,
      status: newStatus as any,
    });
  };

  const onSubmit = async (data: TarefaInput) => {
    try {
      if (editingTarefa) {
        await updateTarefa.mutateAsync(data);
      } else {
        await createTarefa.mutateAsync(data);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getPriorityColor = (p: string | null) => {
    switch (p) {
      case 'ALTA': return 'bg-red-100 text-red-700';
      case 'MEDIA': return 'bg-amber-100 text-amber-700';
      case 'BAIXA': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-bold text-[#1e293b]">Início</h1>
        <p className="text-[#64748b] text-lg mt-1">Bem-vindo de volta. Veja o que há de novo hoje.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Andamentos Recentes */}
        <div className="lg:col-span-2">
          {/* ... Andamentos Card Content ... */}
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-8">
          {/* Tarefas */}
          <Card className="border-none shadow-sm min-h-[500px] flex flex-col bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#2563eb]" />
                <CardTitle className="text-xl font-bold text-[#1e293b]">Tarefas</CardTitle>
              </div>
              <Button 
                onClick={handleCreate}
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full bg-[#2563eb] text-white hover:bg-[#1d4ed8] hover:text-white"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-auto max-h-[600px]">
              {isLoadingTarefas ? (
                <div className="flex flex-col items-center justify-center h-full p-10 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p>Carregando tarefas...</p>
                </div>
              ) : tarefas?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                   <div className="w-16 h-16 rounded-2xl bg-[#f1f5f9] flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-[#cbd5e1]" />
                  </div>
                  <p className="text-[#64748b] font-medium">Sem tarefas pendentes.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#f1f5f9]">
                  {tarefas?.map((tarefa: Tarefa) => (
                    <div key={tarefa.id} className={cn(
                      "p-4 group hover:bg-[#f8fafc] transition-colors",
                      tarefa.status === 'CONCLUIDA' && "bg-slate-50/50"
                    )}>
                      <div className="flex items-start gap-3">
                        <button 
                          onClick={() => toggleStatus(tarefa)}
                          className={cn(
                            "mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                            tarefa.status === 'CONCLUIDA' 
                              ? "bg-green-500 border-green-500 text-white" 
                              : "border-slate-300 hover:border-[#2563eb]"
                          )}
                        >
                          {tarefa.status === 'CONCLUIDA' && <CheckCircle className="w-3.5 h-3.5" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className={cn(
                            "text-sm font-bold truncate",
                            tarefa.status === 'CONCLUIDA' ? "text-slate-400 line-through" : "text-[#1e293b]"
                          )}>
                            {tarefa.titulo}
                          </h4>
                          {tarefa.descricao && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 italic">
                              {tarefa.descricao}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge className={cn("text-[10px] px-1.5 py-0 border-none font-bold", getPriorityColor(tarefa.prioridade))}>
                              {tarefa.prioridade}
                            </Badge>
                            
                            {tarefa.dataLimite && (
                              <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                <Calendar className="w-3 h-3" />
                                {new Date(tarefa.dataLimite).toLocaleDateString('pt-BR')}
                              </div>
                            )}

                            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                <UserIcon className="w-3 h-3" />
                                {tarefa.usuario?.nome.split(' ')[0]}
                            </div>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(tarefa)}>
                              <Edit2 className="w-3.5 h-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(tarefa.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dica do Dia */}
          <Card className="border-none shadow-sm bg-[#eff6ff]">
            <CardContent className="p-6 space-y-3">
              <h4 className="text-[10px] font-black text-[#2563eb] tracking-wider uppercase">DICA DO DIA</h4>
              <p className="text-sm text-[#1e3a8a] italic font-medium leading-relaxed">
                "Mantenha os cadastros de clientes sempre atualizados para garantir a agilidade nas consultas ao Datajud."
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTarefa ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
            <DialogDescription>
              {editingTarefa ? 'Atualize os detalhes da tarefa selecionada.' : 'Crie uma nova tarefa e atribua a um colaborador.'}
            </DialogDescription>
          </DialogHeader>
          <TarefaForm 
            initialData={editingTarefa}
            onSubmit={onSubmit}
            isSubmitting={createTarefa.isPending || updateTarefa.isPending}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
