// Lista oficial de rubricas SIT/TCE-PR usadas no módulo financeiro.
// Fonte: planilha institucional rubricas-sistema.
// Mantenha sincronizado com a tabela `categorias_financeiras` (codigo é a chave).
export interface RubricaOficial {
  codigo: string;
  descricao: string;
}

export const RUBRICAS_OFICIAIS: RubricaOficial[] = [
  { codigo: "3.1.90.11.01", descricao: "VENCIMENTOS E SALÁRIOS" },
  { codigo: "3.1.90.11.43", descricao: "13º SALÁRIO" },
  { codigo: "3.1.90.11.45", descricao: "FÉRIAS - ABONO CONSTITUCIONAL" },
  { codigo: "3.1.90.13.01", descricao: "FGTS" },
  { codigo: "3.1.90.13.02", descricao: "CONTRIBUIÇÕES PREVIDENCIÁRIAS - INSS" },
  { codigo: "3.1.90.16.00", descricao: "OUTRAS DESPESAS VARIÁVEIS - PESSOAL CIVIL" },
  { codigo: "3.1.90.47.99", descricao: "OUTRAS OBRIGAÇÕES TRIBUTÁRIAS E CONTRIBUTIVAS (PESSOAL)" },
  { codigo: "3.1.90.49.00", descricao: "AUXÍLIO-TRANSPORTE" },
  { codigo: "3.1.90.94.00", descricao: "INDENIZAÇÕES E RESTITUIÇÕES TRABALHISTAS" },
  { codigo: "3.3.90.30.01", descricao: "COMBUSTÍVEIS E LUBRIFICANTES AUTOMOTIVOS" },
  { codigo: "3.3.90.30.07", descricao: "GÊNEROS DE ALIMENTAÇÃO" },
  { codigo: "3.3.90.30.14", descricao: "MATERIAL EDUCATIVO E ESPORTIVO" },
  { codigo: "3.3.90.30.16", descricao: "MATERIAL DE EXPEDIENTE" },
  { codigo: "3.3.90.30.22", descricao: "MATERIAL DE LIMPEZA E PRODUTOS DE HIGIENIZAÇÃO" },
  { codigo: "3.3.90.30.23", descricao: "UNIFORMES, TECIDOS E AVIAMENTOS" },
  { codigo: "3.3.90.36.15", descricao: "LOCAÇÃO DE IMÓVEIS" },
  { codigo: "3.3.90.36.26", descricao: "SERVIÇOS DOMÉSTICOS" },
  { codigo: "3.3.90.39.05", descricao: "SERVIÇOS TÉCNICOS PROFISSIONAIS" },
  { codigo: "3.3.90.39.19", descricao: "MANUTENÇÃO E CONSERVAÇÃO DE VEÍCULOS" },
  { codigo: "3.3.90.39.43", descricao: "SERVIÇOS DE ENERGIA ELÉTRICA" },
  { codigo: "3.3.90.39.44", descricao: "SERVIÇOS DE ÁGUA E ESGOTO" },
  { codigo: "3.3.90.39.69", descricao: "SEGUROS EM GERAL" },
  { codigo: "3.3.90.39.81", descricao: "SERVIÇOS BANCÁRIOS" },
  { codigo: "3.3.90.39.99", descricao: "OUTROS SERVIÇOS DE TERCEIROS, PESSOA JURÍDICA" },
  { codigo: "3.3.90.40.97", descricao: "DESPESAS DE TELEPROCESSAMENTO" },
  { codigo: "3.3.90.47.99", descricao: "OUTRAS OBRIGAÇÕES TRIBUTÁRIAS E CONTRIBUTIVAS" },
  { codigo: "4.4.90.52.52", descricao: "VEÍCULOS DE TRAÇÃO MECÂNICA" },
  { codigo: "4.4.90.52.99", descricao: "OUTROS MATERIAIS PERMANENTES" },
];

export const RUBRICA_CODIGOS = RUBRICAS_OFICIAIS.map((r) => r.codigo);