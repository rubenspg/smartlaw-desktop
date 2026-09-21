-- Permite tarefas e compromissos atribuídos à equipe como um todo (sem usuário específico)
ALTER TABLE "tarefas" ALTER COLUMN "usuario_id" DROP NOT NULL;
