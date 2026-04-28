---
name: Roteiros de Visita Domiciliar
description: Equipe técnica monta roteiros agrupados por bairro a partir de Busca Ativa e Matrículas Pendentes, com cards interativos, geração de atendimento e exportação PDF
type: feature
---
Hub na aba "Roteiros" da Equipe Técnica. Tabelas: roteiros_visita + roteiro_visitas (RLS tecnico/coord).
Wizard 2 etapas: dados (titulo, data, horário, veículo, responsáveis multi) + seleção de participantes filtrável por bairro/status (busca_ativa, pendente, incompleto).
Página detalhe: cards por bairro com status (pendente/realizada/nao_atendido/recusou/endereco_nao_encontrado), relato, horário realizado e botão "Gerar atendimento" que cria registro em `atendimentos` tipo visita_domiciliar e vincula via `atendimento_id`.
Exportação PDF (jsPDF) com layout impresso A4, 1 card retangular por visita, marcadores para preenchimento manual no campo. Nome via sysCfvFileName("RoteiroVisita", "pdf", titulo).
Rotas: /equipe-tecnica/roteiros/novo e /equipe-tecnica/roteiros/:id. Lista integrada como TabsContent dentro de EquipeTecnicaPage.
