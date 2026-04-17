import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useClientes } from '@/hooks/use-clientes';

export const Route = createFileRoute('/_dashboard/clientes/')({
  component: ClientesListPage,
});

function ClientesListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [situacao, setSituacao] = useState('A');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, isError } = useClientes({ 
    q, 
    situacao: situacao === 'all' ? undefined : situacao, 
    page, 
    limit 
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gerencie o cadastro e atendimentos de clientes.
          </p>
        </div>
        <Button onClick={() => navigate({ to: '/clientes/novo' })}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF/CNPJ, email..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={situacao}
            onValueChange={(val) => { setSituacao(val); setPage(1); }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Situações</SelectItem>
              <SelectItem value="A">Ativo</SelectItem>
              <SelectItem value="I">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nome / Fantasia</TableHead>
              <TableHead>CPF / CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Carregando clientes...
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-destructive">
                  Erro ao carregar clientes.
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((cliente: any) => (
                <TableRow 
                  key={cliente.id} 
                  className="cursor-pointer"
                  onClick={() => navigate({ to: '/clientes/$id', params: { id: cliente.id.toString() } })}
                >
                  <TableCell>
                    <div className="font-semibold">{cliente.nome}</div>
                    {cliente.fantasia && (
                      <div className="text-xs text-muted-foreground">{cliente.fantasia}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {cliente.cpfCnpj || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{cliente.email || '-'}</div>
                    <div className="text-xs text-muted-foreground">
                      {cliente.celular || cliente.telefone1 || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cliente.situacao === 'A' ? 'default' : 'destructive'}>
                      {cliente.situacao === 'A' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate({ to: '/clientes/$id', params: { id: cliente.id.toString() } })}>
                          Ver Detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate({ to: '/clientes/$id/editar', params: { id: cliente.id.toString() } })}>
                          Editar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {data && data.totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Mostrando {data.data.length} de {data.total} clientes
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={page === data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
