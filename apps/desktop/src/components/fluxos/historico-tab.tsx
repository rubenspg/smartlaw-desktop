import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkflowExecucoes } from '@/hooks/use-workflows';
import { GATILHO_LABEL } from './descrever';

const STATUS: Record<string, { label: string; variant: 'success' | 'destructive' | 'secondary' }> = {
  SUCESSO: { label: 'Sucesso', variant: 'success' },
  ERRO: { label: 'Erro', variant: 'destructive' },
  IGNORADO: { label: 'Ignorado', variant: 'secondary' },
};

/** Últimas execuções (200) de todos os fluxos, ou de um só. */
export function HistoricoTab({ workflowId }: { workflowId?: number }) {
  const { data, isLoading } = useWorkflowExecucoes(workflowId);

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Fluxo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>O que aconteceu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                <Loader2 className="w-5 h-5 animate-spin inline" />
              </TableCell>
            </TableRow>
          ) : !data?.length ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Nenhuma execução ainda.
              </TableCell>
            </TableRow>
          ) : (
            data.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {format(parseISO(e.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{e.workflowNome}</div>
                  <div className="text-xs text-muted-foreground">
                    {GATILHO_LABEL[e.gatilho] ?? e.gatilho}
                    {e.disparadoPorNome ? ` · por ${e.disparadoPorNome}` : ''}
                  </div>
                </TableCell>
                <TableCell>
                  {e.clienteId && e.clienteNome ? (
                    <Link to="/clientes/$id" params={{ id: e.clienteId.toString() }} className="hover:underline">
                      {e.clienteNome}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS[e.status]?.variant ?? 'secondary'}>{STATUS[e.status]?.label ?? e.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {e.erro && <p className="text-destructive">{e.erro}</p>}
                  {e.resultado.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
