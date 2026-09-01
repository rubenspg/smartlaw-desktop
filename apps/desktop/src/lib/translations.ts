// UI strings. Single language (pt-BR) for now — the multi-language selector and
// the en-US/es-ES tables were removed because they were never wired up beyond a
// handful of strings (see #29). Re-introduce a language dimension here if/when
// real localization is actually needed.
export const strings = {
  "nav.home": "Início",
  "nav.agenda": "Agenda",
  "nav.clients": "Clientes",
  "nav.processes": "Processos",
  "nav.finance": "Financeiro",
  "nav.insights": "Insights",
  "nav.admin": "Administrativo",
  "nav.settings": "Configurações",
  "nav.logout": "Sair",
  "home.welcome": "Bem-vindo de volta. Veja o que há de novo hoje.",
  "home.ai_summary": "INTELIGÊNCIA ARTIFICIAL",
  "home.recent_updates": "Andamentos Recentes",
  "home.tasks": "Tarefas",
  "home.new_task": "Nova Tarefa",
  "home.tip_of_day": "DICA OPERACIONAL",
  "settings.title": "Configurações",
  "settings.description": "Personalize sua experiência e gerencie as preferências do seu sistema.",
  "settings.save_all": "Salvar Tudo",
  "settings.general": "Geral",
  "settings.profile": "Perfil",
  "settings.firm": "Escritório",
  "settings.automations": "Automações",
  "settings.appearance": "Aparência",
  "settings.regional": "Regional",
  "settings.language": "Idioma",
  "settings.currency": "Moeda",
  "settings.timezone": "Fuso Horário",
  "settings.system": "Sistema e Rede",
  "settings.server_url": "URL do Servidor API",
} as const;

export type TranslationKey = keyof typeof strings;
