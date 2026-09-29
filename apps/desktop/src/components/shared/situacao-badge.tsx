import { Badge } from '@/components/ui/badge';
import { useClienteSituacoes } from '@/hooks/use-cliente-situacoes';
import { cn } from '@/lib/utils';

/** Nome de exibição de um código de situação; o próprio código se não achar. */
export function useNomeSituacao() {
  const { data: situacoes } = useClienteSituacoes();
  return (codigo: string | null | undefined) =>
    situacoes?.find((s) => s.codigo === codigo)?.nome ?? codigo ?? '—';
}

/**
 * Situação do cliente com o nome e a cor que o escritório configurou.
 * Enquanto a lista carrega (ou se o código não existir mais) mostra o código.
 */
export function SituacaoBadge({ codigo, className }: { codigo: string | null | undefined; className?: string }) {
  const { data: situacoes } = useClienteSituacoes();
  const situacao = situacoes?.find((s) => s.codigo === codigo);
  return (
    <Badge variant={situacao?.cor ?? 'secondary'} className={cn(className)}>
      {situacao?.nome ?? codigo ?? '—'}
    </Badge>
  );
}
