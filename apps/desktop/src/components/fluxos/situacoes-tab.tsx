import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { SITUACAO_CORES, type ClienteSituacaoInput } from '@smartlaw/shared';
import type { ClienteSituacao } from '@/lib/entities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import {
  useClienteSituacoes,
  useExcluirClienteSituacao,
  useSalvarClienteSituacao,
} from '@/hooks/use-cliente-situacoes';

const COR_LABEL: Record<(typeof SITUACAO_CORES)[number], string> = {
  success: 'Verde',
  warning: 'Amarelo',
  destructive: 'Vermelho',
  secondary: 'Cinza',
  default: 'Destaque',
};

const NOVA: ClienteSituacaoInput = { nome: '', cor: 'secondary', contaComoAtivo: true, ordem: 50 };

export function SituacoesTab() {
  const { data: situacoes, isLoading } = useClienteSituacoes();
  const salvar = useSalvarClienteSituacao();
  const excluir = useExcluirClienteSituacao();
  const confirm = useConfirm();
  const toast = useToast();
  const [editando, setEditando] = useState<{ id?: number; data: ClienteSituacaoInput } | null>(null);

  const editar = (s: ClienteSituacao) =>
    setEditando({ id: s.id, data: { nome: s.nome, cor: s.cor, contaComoAtivo: s.contaComoAtivo, ordem: s.ordem } });

  const gravar = async () => {
    if (!editando) return;
    try {
      await salvar.mutateAsync(editando);
      setEditando(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remover = async (s: ClienteSituacao) => {
    if (!(await confirm({ description: `Excluir a situação "${s.nome}"?`, destructive: true, confirmText: 'Excluir' }))) return;
    try {
      await excluir.mutateAsync(s.id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Situações de cliente</CardTitle>
            <CardDescription>
              As situações que os clientes podem ter e que os fluxos podem aplicar. As marcadas como
              “conta como ativo” aparecem no filtro padrão da lista de clientes.
            </CardDescription>
          </div>
          <Button onClick={() => setEditando({ data: NOVA })}>
            <Plus className="w-4 h-4 mr-2" /> Nova situação
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {situacoes?.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3">
                <Badge variant={s.cor}>{s.nome}</Badge>
                <span className="text-xs text-muted-foreground font-mono">{s.codigo}</span>
                {!s.contaComoAtivo && <span className="text-xs text-muted-foreground">não conta como ativo</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => editar(s)} title="Editar">
                  <Pencil className="w-4 h-4" />
                </Button>
                {!s.sistema && (
                  <Button variant="ghost" size="icon" onClick={() => remover(s)} title="Excluir">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {editando && (
        <Card>
          <CardHeader>
            <CardTitle>{editando.id ? 'Editar situação' : 'Nova situação'}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="situacao-nome">Nome</Label>
              <Input
                id="situacao-nome"
                value={editando.data.nome}
                onChange={(e) => setEditando({ ...editando, data: { ...editando.data, nome: e.target.value } })}
                placeholder="Ex: Aguardando documentos"
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select
                value={editando.data.cor}
                onValueChange={(cor) =>
                  setEditando({ ...editando, data: { ...editando.data, cor: cor as ClienteSituacaoInput['cor'] } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITUACAO_CORES.map((c) => (
                    <SelectItem key={c} value={c}>{COR_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="situacao-ordem">Ordem</Label>
              <Input
                id="situacao-ordem"
                type="number"
                min={0}
                max={999}
                value={editando.data.ordem}
                onChange={(e) => setEditando({ ...editando, data: { ...editando.data, ordem: Number(e.target.value) } })}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <Switch
                id="situacao-ativo"
                checked={editando.data.contaComoAtivo}
                onCheckedChange={(contaComoAtivo) => setEditando({ ...editando, data: { ...editando.data, contaComoAtivo } })}
              />
              <Label htmlFor="situacao-ativo">Conta como ativo</Label>
            </div>
            <div className="flex justify-end gap-2 md:col-span-2">
              <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button onClick={gravar} disabled={salvar.isPending || !editando.data.nome.trim()}>
                {salvar.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
