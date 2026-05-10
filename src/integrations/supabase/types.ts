export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      atendimentos: {
        Row: {
          busca_ativa_origem_id: string | null
          created_at: string
          data_atendimento: string
          descricao: string
          drive_file_id: string | null
          drive_url: string | null
          encaminhamento: string | null
          id: string
          participante_id: string
          profissional_id: string
          recado_origem_id: string | null
          relato_origem_id: string | null
          sigiloso: boolean
          tipo: string
        }
        Insert: {
          busca_ativa_origem_id?: string | null
          created_at?: string
          data_atendimento?: string
          descricao?: string
          drive_file_id?: string | null
          drive_url?: string | null
          encaminhamento?: string | null
          id?: string
          participante_id: string
          profissional_id: string
          recado_origem_id?: string | null
          relato_origem_id?: string | null
          sigiloso?: boolean
          tipo?: string
        }
        Update: {
          busca_ativa_origem_id?: string | null
          created_at?: string
          data_atendimento?: string
          descricao?: string
          drive_file_id?: string | null
          drive_url?: string | null
          encaminhamento?: string | null
          id?: string
          participante_id?: string
          profissional_id?: string
          recado_origem_id?: string | null
          relato_origem_id?: string | null
          sigiloso?: boolean
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          detalhes: string | null
          id: string
          justificativa: string | null
          registro_id: string | null
          tabela: string
          user_id: string
          user_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: string | null
          id?: string
          justificativa?: string | null
          registro_id?: string | null
          tabela: string
          user_id: string
          user_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          justificativa?: string | null
          registro_id?: string | null
          tabela?: string
          user_id?: string
          user_nome?: string | null
        }
        Relationships: []
      }
      auditoria_abril_desligamentos: {
        Row: {
          created_at: string
          data_saida_efetiva: string
          id: string
          motivo: string | null
          participante_id: string
          revisado: boolean
          revisado_em: string | null
          revisado_por: string | null
          turma_id: string | null
        }
        Insert: {
          created_at?: string
          data_saida_efetiva?: string
          id?: string
          motivo?: string | null
          participante_id: string
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          turma_id?: string | null
        }
        Update: {
          created_at?: string
          data_saida_efetiva?: string
          id?: string
          motivo?: string | null
          participante_id?: string
          revisado?: boolean
          revisado_em?: string | null
          revisado_por?: string | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_abril_desligamentos_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditoria_abril_desligamentos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_sistema: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          expires_at: string | null
          id: string
          mensagem: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          expires_at?: string | null
          id?: string
          mensagem: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          expires_at?: string | null
          id?: string
          mensagem?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_sistema_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avisos_sistema_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      bairros: {
        Row: {
          id: string
          meta_criancas_manha: number | null
          meta_criancas_tarde: number | null
          meta_idosos: number | null
          nome: string
        }
        Insert: {
          id?: string
          meta_criancas_manha?: number | null
          meta_criancas_tarde?: number | null
          meta_idosos?: number | null
          nome: string
        }
        Update: {
          id?: string
          meta_criancas_manha?: number | null
          meta_criancas_tarde?: number | null
          meta_idosos?: number | null
          nome?: string
        }
        Relationships: []
      }
      busca_ativa_registros: {
        Row: {
          atendimento_id: string | null
          created_at: string
          data_registro: string
          descricao: string
          id: string
          participante_id: string
          profissional_id: string
          resultado: string | null
          tipo_contato: string
        }
        Insert: {
          atendimento_id?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string
          id?: string
          participante_id: string
          profissional_id: string
          resultado?: string | null
          tipo_contato?: string
        }
        Update: {
          atendimento_id?: string | null
          created_at?: string
          data_registro?: string
          descricao?: string
          id?: string
          participante_id?: string
          profissional_id?: string
          resultado?: string | null
          tipo_contato?: string
        }
        Relationships: [
          {
            foreignKeyName: "busca_ativa_registros_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "busca_ativa_registros_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "busca_ativa_registros_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          valor_previsto: number | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          valor_previsto?: number | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          valor_previsto?: number | null
        }
        Relationships: []
      }
      chamadas_assinadas: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          mes_referencia: string
          turma_id: string
          uploaded_by: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          mes_referencia: string
          turma_id: string
          uploaded_by: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          mes_referencia?: string
          turma_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "chamadas_assinadas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_gerais: {
        Row: {
          chave: string
          created_at: string
          id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      conquistas: {
        Row: {
          created_at: string
          id: string
          nivel: number
          perfil_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nivel?: number
          perfil_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          nivel?: number
          perfil_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conquistas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conquistas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coordenacao_atividades: {
        Row: {
          categoria: string
          coordenador_id: string
          created_at: string
          data: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          prazo: string | null
          prioridade: string
          responsaveis: string[] | null
          status: string
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          coordenador_id: string
          created_at?: string
          data?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          prazo?: string | null
          prioridade?: string
          responsaveis?: string[] | null
          status?: string
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          coordenador_id?: string
          created_at?: string
          data?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          prazo?: string | null
          prioridade?: string
          responsaveis?: string[] | null
          status?: string
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cozinha_cardapio: {
        Row: {
          created_at: string
          criado_por: string | null
          dia_semana: number
          id: string
          insumos_previstos: Json
          prato: string
          refeicao: string
          semana_inicio: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          dia_semana: number
          id?: string
          insumos_previstos?: Json
          prato?: string
          refeicao: string
          semana_inicio: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          dia_semana?: number
          id?: string
          insumos_previstos?: Json
          prato?: string
          refeicao?: string
          semana_inicio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cozinha_cardapio_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cozinha_cardapio_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cozinha_insumos: {
        Row: {
          categoria: string
          created_at: string
          estoque_minimo: number
          id: string
          nome: string
          observacao: string | null
          quantidade_atual: number
          unidade: string
          updated_at: string
          validade: string | null
          valor_unitario: number | null
        }
        Insert: {
          categoria?: string
          created_at?: string
          estoque_minimo?: number
          id?: string
          nome: string
          observacao?: string | null
          quantidade_atual?: number
          unidade?: string
          updated_at?: string
          validade?: string | null
          valor_unitario?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string
          estoque_minimo?: number
          id?: string
          nome?: string
          observacao?: string | null
          quantidade_atual?: number
          unidade?: string
          updated_at?: string
          validade?: string | null
          valor_unitario?: number | null
        }
        Relationships: []
      }
      cozinha_movimentacoes: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          motivo: string | null
          quantidade: number
          responsavel_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          motivo?: string | null
          quantidade: number
          responsavel_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          motivo?: string | null
          quantidade?: number
          responsavel_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cozinha_movimentacoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "cozinha_insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cozinha_movimentacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cozinha_movimentacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_cenarios: {
        Row: {
          ativo: boolean
          created_at: string
          criado_por: string | null
          id: string
          nome: string
          regras_frequencia: Json | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
          regras_frequencia?: Json | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
          regras_frequencia?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_cenarios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_cenarios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_disponibilidade: {
        Row: {
          created_at: string
          dia_semana: string
          disponivel: boolean
          id: string
          periodo: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: string
          disponivel?: boolean
          id?: string
          periodo?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: string
          disponivel?: boolean
          id?: string
          periodo?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_disponibilidade_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_disponibilidade_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_slots: {
        Row: {
          bairro_id: string | null
          cenario_id: string
          created_at: string
          dia_semana: string
          educador_id: string | null
          id: string
          notas: string | null
          oficineiro_id: string | null
          periodo: string
          tipo_atividade: string | null
          turma_id: string | null
        }
        Insert: {
          bairro_id?: string | null
          cenario_id: string
          created_at?: string
          dia_semana: string
          educador_id?: string | null
          id?: string
          notas?: string | null
          oficineiro_id?: string | null
          periodo?: string
          tipo_atividade?: string | null
          turma_id?: string | null
        }
        Update: {
          bairro_id?: string | null
          cenario_id?: string
          created_at?: string
          dia_semana?: string
          educador_id?: string | null
          id?: string
          notas?: string | null
          oficineiro_id?: string | null
          periodo?: string
          tipo_atividade?: string | null
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_slots_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_slots_cenario_id_fkey"
            columns: ["cenario_id"]
            isOneToOne: false
            referencedRelation: "cronograma_cenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_slots_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_slots_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_slots_oficineiro_id_fkey"
            columns: ["oficineiro_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_slots_oficineiro_id_fkey"
            columns: ["oficineiro_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_slots_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesa_historico: {
        Row: {
          alterado_por: string | null
          campo: string
          created_at: string
          despesa_id: string
          id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por?: string | null
          campo: string
          created_at?: string
          despesa_id: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string | null
          campo?: string
          created_at?: string
          despesa_id?: string
          id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      despesa_lotes_importacao: {
        Row: {
          arquivos: Json
          confirmado_em: string
          confirmado_por: string
          confirmado_por_nome: string | null
          id: string
          lote_id: string
          mes_referencia: string
          resumo_warnings: Json
          total_ajustes: number
          total_bloqueadas: number
          total_despesas: number
          total_ok: number
        }
        Insert: {
          arquivos?: Json
          confirmado_em?: string
          confirmado_por: string
          confirmado_por_nome?: string | null
          id?: string
          lote_id: string
          mes_referencia: string
          resumo_warnings?: Json
          total_ajustes?: number
          total_bloqueadas?: number
          total_despesas?: number
          total_ok?: number
        }
        Update: {
          arquivos?: Json
          confirmado_em?: string
          confirmado_por?: string
          confirmado_por_nome?: string | null
          id?: string
          lote_id?: string
          mes_referencia?: string
          resumo_warnings?: Json
          total_ajustes?: number
          total_bloqueadas?: number
          total_despesas?: number
          total_ok?: number
        }
        Relationships: []
      }
      despesas: {
        Row: {
          boleto_url: string | null
          categoria_id: string | null
          cnpj_cpf: string | null
          codigo_lancamento: string | null
          comprovante_url: string | null
          created_at: string | null
          data_lancamento: string
          descricao: string
          fornecedor: string | null
          id: string
          lote_id: string | null
          lote_origem_pdf: string | null
          mes_referencia: string
          nota_url: string | null
          numero_documento: string | null
          orcamento_id: string | null
          pendente_comprovante: boolean
          sit_ano_transferencia: number | null
          sit_codigo_tipo_despesa: number | null
          sit_completo: boolean
          sit_data_debito: string | null
          sit_data_doc_despesa: string | null
          sit_data_emissao_pagamento: string | null
          sit_data_empenho: string | null
          sit_data_processo: string | null
          sit_descricao_item: string | null
          sit_modalidade_compra: number | null
          sit_nome_favorecido: string | null
          sit_numero_doc_despesa: string | null
          sit_numero_doc_pagamento: string | null
          sit_numero_empenho: string | null
          sit_numero_instrumento: string | null
          sit_numero_processo: string | null
          sit_placa_veiculo: string | null
          sit_quilometragem: number | null
          sit_tipo_doc_despesa: number | null
          sit_tipo_doc_favorecido: string | null
          sit_tipo_doc_pagamento: number | null
          sit_tipo_transferencia: number | null
          status_sit: string | null
          tipo_documento: string | null
          valor: number
        }
        Insert: {
          boleto_url?: string | null
          categoria_id?: string | null
          cnpj_cpf?: string | null
          codigo_lancamento?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          data_lancamento: string
          descricao: string
          fornecedor?: string | null
          id?: string
          lote_id?: string | null
          lote_origem_pdf?: string | null
          mes_referencia: string
          nota_url?: string | null
          numero_documento?: string | null
          orcamento_id?: string | null
          pendente_comprovante?: boolean
          sit_ano_transferencia?: number | null
          sit_codigo_tipo_despesa?: number | null
          sit_completo?: boolean
          sit_data_debito?: string | null
          sit_data_doc_despesa?: string | null
          sit_data_emissao_pagamento?: string | null
          sit_data_empenho?: string | null
          sit_data_processo?: string | null
          sit_descricao_item?: string | null
          sit_modalidade_compra?: number | null
          sit_nome_favorecido?: string | null
          sit_numero_doc_despesa?: string | null
          sit_numero_doc_pagamento?: string | null
          sit_numero_empenho?: string | null
          sit_numero_instrumento?: string | null
          sit_numero_processo?: string | null
          sit_placa_veiculo?: string | null
          sit_quilometragem?: number | null
          sit_tipo_doc_despesa?: number | null
          sit_tipo_doc_favorecido?: string | null
          sit_tipo_doc_pagamento?: number | null
          sit_tipo_transferencia?: number | null
          status_sit?: string | null
          tipo_documento?: string | null
          valor: number
        }
        Update: {
          boleto_url?: string | null
          categoria_id?: string | null
          cnpj_cpf?: string | null
          codigo_lancamento?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao?: string
          fornecedor?: string | null
          id?: string
          lote_id?: string | null
          lote_origem_pdf?: string | null
          mes_referencia?: string
          nota_url?: string | null
          numero_documento?: string | null
          orcamento_id?: string | null
          pendente_comprovante?: boolean
          sit_ano_transferencia?: number | null
          sit_codigo_tipo_despesa?: number | null
          sit_completo?: boolean
          sit_data_debito?: string | null
          sit_data_doc_despesa?: string | null
          sit_data_emissao_pagamento?: string | null
          sit_data_empenho?: string | null
          sit_data_processo?: string | null
          sit_descricao_item?: string | null
          sit_modalidade_compra?: number | null
          sit_nome_favorecido?: string | null
          sit_numero_doc_despesa?: string | null
          sit_numero_doc_pagamento?: string | null
          sit_numero_empenho?: string | null
          sit_numero_instrumento?: string | null
          sit_numero_processo?: string | null
          sit_placa_veiculo?: string | null
          sit_quilometragem?: number | null
          sit_tipo_doc_despesa?: number | null
          sit_tipo_doc_favorecido?: string | null
          sit_tipo_doc_pagamento?: number | null
          sit_tipo_transferencia?: number | null
          status_sit?: string | null
          tipo_documento?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_prestacao_contas: {
        Row: {
          arquivo_url: string
          categoria: string
          created_at: string | null
          descricao: string | null
          drive_file_id: string | null
          drive_url: string | null
          id: string
          nome_arquivo: string
          titulo: string
          uploaded_by: string | null
          versao: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          arquivo_url: string
          categoria: string
          created_at?: string | null
          descricao?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          id?: string
          nome_arquivo: string
          titulo: string
          uploaded_by?: string | null
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          arquivo_url?: string
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          id?: string
          nome_arquivo?: string
          titulo?: string
          uploaded_by?: string | null
          versao?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: []
      }
      drive_folder_cache: {
        Row: {
          chave: string
          created_at: string
          folder_id: string
          id: string
        }
        Insert: {
          chave: string
          created_at?: string
          folder_id: string
          id?: string
        }
        Update: {
          chave?: string
          created_at?: string
          folder_id?: string
          id?: string
        }
        Relationships: []
      }
      drive_modelos: {
        Row: {
          copia_doc_id: string | null
          copia_renovada_em: string | null
          copia_url: string | null
          created_at: string
          template_doc_id: string
          template_url: string | null
          tipo: string
          ultima_atualizacao_origem: string | null
          updated_at: string
        }
        Insert: {
          copia_doc_id?: string | null
          copia_renovada_em?: string | null
          copia_url?: string | null
          created_at?: string
          template_doc_id: string
          template_url?: string | null
          tipo: string
          ultima_atualizacao_origem?: string | null
          updated_at?: string
        }
        Update: {
          copia_doc_id?: string | null
          copia_renovada_em?: string | null
          copia_url?: string | null
          created_at?: string
          template_doc_id?: string
          template_url?: string | null
          tipo?: string
          ultima_atualizacao_origem?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      drive_planilhas_mensais: {
        Row: {
          ano_mes: string
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ano_mes: string
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ano_mes?: string
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      drive_sync_queue: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_url: string | null
          id: string
          origem_id: string
          payload: Json | null
          status: string
          synced_at: string | null
          tentativas: number
          tipo: string
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          id?: string
          origem_id: string
          payload?: Json | null
          status?: string
          synced_at?: string | null
          tentativas?: number
          tipo: string
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_url?: string | null
          id?: string
          origem_id?: string
          payload?: Json | null
          status?: string
          synced_at?: string | null
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      encaminhamentos_externos: {
        Row: {
          atendimento_id: string | null
          contato: string | null
          created_at: string
          data_encaminhamento: string
          data_retorno: string | null
          id: string
          motivo: string
          observacoes_retorno: string | null
          orgao: string
          participante_id: string
          profissional_id: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          atendimento_id?: string | null
          contato?: string | null
          created_at?: string
          data_encaminhamento?: string
          data_retorno?: string | null
          id?: string
          motivo?: string
          observacoes_retorno?: string | null
          orgao: string
          participante_id: string
          profissional_id: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          atendimento_id?: string | null
          contato?: string | null
          created_at?: string
          data_encaminhamento?: string
          data_retorno?: string | null
          id?: string
          motivo?: string
          observacoes_retorno?: string | null
          orgao?: string
          participante_id?: string
          profissional_id?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      estornos: {
        Row: {
          categoria_id: string | null
          created_at: string | null
          id: string
          mes_referencia: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string | null
          id?: string
          mes_referencia: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string | null
          id?: string
          mes_referencia?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "estornos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      familia_acessos: {
        Row: {
          acoes: Json
          created_at: string
          duracao_segundos: number | null
          encerrado_em: string | null
          id: string
          iniciado_em: string
          ip_address: string | null
          match_type: string | null
          participante_id: string | null
          participante_ids: string[] | null
          participante_nome: string | null
          total_acoes: number
          ultimo_ping_em: string
          user_agent: string | null
        }
        Insert: {
          acoes?: Json
          created_at?: string
          duracao_segundos?: number | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          ip_address?: string | null
          match_type?: string | null
          participante_id?: string | null
          participante_ids?: string[] | null
          participante_nome?: string | null
          total_acoes?: number
          ultimo_ping_em?: string
          user_agent?: string | null
        }
        Update: {
          acoes?: Json
          created_at?: string
          duracao_segundos?: number | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          ip_address?: string | null
          match_type?: string | null
          participante_id?: string | null
          participante_ids?: string[] | null
          participante_nome?: string | null
          total_acoes?: number
          ultimo_ping_em?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      feed_comentarios: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          feed_post_id: string
          id: string
          mencoes: string[] | null
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          feed_post_id: string
          id?: string
          mencoes?: string[] | null
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          feed_post_id?: string
          id?: string
          mencoes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comentarios_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_fotos: {
        Row: {
          feed_post_id: string
          foto_url: string
          id: string
          ordem: number | null
        }
        Insert: {
          feed_post_id: string
          foto_url: string
          id?: string
          ordem?: number | null
        }
        Update: {
          feed_post_id?: string
          foto_url?: string
          id?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_fotos_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          id: string
          mencoes: string[] | null
          relatorio_id: string | null
          tipo: Database["public"]["Enums"]["tipo_feed_post"]
        }
        Insert: {
          autor_id: string
          conteudo?: string
          created_at?: string
          id?: string
          mencoes?: string[] | null
          relatorio_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_feed_post"]
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          mencoes?: string[] | null
          relatorio_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_feed_post"]
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_reacoes: {
        Row: {
          created_at: string
          feed_post_id: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_reacao"]
          user_id: string
        }
        Insert: {
          created_at?: string
          feed_post_id: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_reacao"]
          user_id: string
        }
        Update: {
          created_at?: string
          feed_post_id?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_reacao"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_reacoes_feed_post_id_fkey"
            columns: ["feed_post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_reacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_respostas: {
        Row: {
          created_at: string
          formulario_id: string
          id: string
          participante_id: string
          responsavel_nome: string | null
          respostas: Json
        }
        Insert: {
          created_at?: string
          formulario_id: string
          id?: string
          participante_id: string
          responsavel_nome?: string | null
          respostas?: Json
        }
        Update: {
          created_at?: string
          formulario_id?: string
          id?: string
          participante_id?: string
          responsavel_nome?: string | null
          respostas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "formulario_respostas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios_familia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      formularios_familia: {
        Row: {
          ativo: boolean
          campos: Json
          created_at: string
          criado_por: string | null
          descricao: string | null
          destinatario_ids: string[] | null
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          campos?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          destinatario_ids?: string[] | null
          id?: string
          tipo?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          campos?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          destinatario_ids?: string[] | null
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "formularios_familia_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_familia_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mural_posts: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          fixado: boolean
          id: string
          tipo: Database["public"]["Enums"]["tipo_mural"]
          titulo: string
        }
        Insert: {
          autor_id: string
          conteudo?: string
          created_at?: string
          fixado?: boolean
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_mural"]
          titulo: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          fixado?: boolean
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_mural"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mural_posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mural_posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_cotacoes: {
        Row: {
          cnpj: string | null
          created_at: string | null
          data_emissao: string | null
          data_validade: string | null
          fornecedor_nome: string
          id: string
          orcamento_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          fornecedor_nome: string
          id?: string
          orcamento_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          fornecedor_nome?: string
          id?: string
          orcamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_cotacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          created_at: string | null
          descricao: string
          id: string
          item_num: number
          orcamento_id: string
          quantidade: number
          unidade_medida: string | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: string
          item_num: number
          orcamento_id: string
          quantidade?: number
          unidade_medida?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: string
          item_num?: number
          orcamento_id?: string
          quantidade?: number
          unidade_medida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_precos: {
        Row: {
          cotacao_id: string
          created_at: string | null
          id: string
          item_id: string
          observacao: string | null
          preco_unitario: number
        }
        Insert: {
          cotacao_id: string
          created_at?: string | null
          id?: string
          item_id: string
          observacao?: string | null
          preco_unitario?: number
        }
        Update: {
          cotacao_id?: string
          created_at?: string | null
          id?: string
          item_id?: string
          observacao?: string | null
          preco_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_precos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "orcamento_cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_precos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          categoria_id: string | null
          cnpj_vencedor: string | null
          created_at: string | null
          data_aprovacao: string | null
          drive_file_id: string | null
          drive_url: string | null
          fornecedor_vencedor: string | null
          id: string
          mes_referencia: string
          objeto: string | null
          observacoes: string | null
          status: string
          titulo: string
        }
        Insert: {
          categoria_id?: string | null
          cnpj_vencedor?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          fornecedor_vencedor?: string | null
          id?: string
          mes_referencia: string
          objeto?: string | null
          observacoes?: string | null
          status?: string
          titulo: string
        }
        Update: {
          categoria_id?: string | null
          cnpj_vencedor?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          fornecedor_vencedor?: string | null
          id?: string
          mes_referencia?: string
          objeto?: string | null
          observacoes?: string | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_financeiras: {
        Row: {
          created_at: string | null
          data_recebimento: string
          id: string
          numero_parcela: number
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_recebimento: string
          id?: string
          numero_parcela: number
          valor: number
        }
        Update: {
          created_at?: string | null
          data_recebimento?: string
          id?: string
          numero_parcela?: number
          valor?: number
        }
        Relationships: []
      }
      participante_checkins: {
        Row: {
          confirmado: boolean
          confirmado_em: string
          confirmado_por: string | null
          created_at: string
          data: string
          embarcou: boolean | null
          embarcou_em: string | null
          embarcou_por: string | null
          id: string
          observacao: string | null
          participante_id: string
          periodo: string
          updated_at: string
        }
        Insert: {
          confirmado?: boolean
          confirmado_em?: string
          confirmado_por?: string | null
          created_at?: string
          data: string
          embarcou?: boolean | null
          embarcou_em?: string | null
          embarcou_por?: string | null
          id?: string
          observacao?: string | null
          participante_id: string
          periodo: string
          updated_at?: string
        }
        Update: {
          confirmado?: boolean
          confirmado_em?: string
          confirmado_por?: string | null
          created_at?: string
          data?: string
          embarcou?: boolean | null
          embarcou_em?: string | null
          embarcou_por?: string | null
          id?: string
          observacao?: string | null
          participante_id?: string
          periodo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participante_checkins_embarcou_por_fkey"
            columns: ["embarcou_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participante_checkins_embarcou_por_fkey"
            columns: ["embarcou_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participante_checkins_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      participante_documentos: {
        Row: {
          arquivo_url: string
          categoria: string
          created_at: string | null
          id: string
          nome_arquivo: string
          participante_id: string
        }
        Insert: {
          arquivo_url: string
          categoria: string
          created_at?: string | null
          id?: string
          nome_arquivo: string
          participante_id: string
        }
        Update: {
          arquivo_url?: string
          categoria?: string
          created_at?: string | null
          id?: string
          nome_arquivo?: string
          participante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participante_documentos_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
        ]
      }
      participante_transferencias: {
        Row: {
          created_at: string | null
          data_transferencia: string
          id: string
          motivo: string | null
          participante_id: string
          turma_destino_id: string | null
          turma_origem_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_transferencia?: string
          id?: string
          motivo?: string | null
          participante_id: string
          turma_destino_id?: string | null
          turma_origem_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_transferencia?: string
          id?: string
          motivo?: string | null
          participante_id?: string
          turma_destino_id?: string | null
          turma_origem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participante_transferencias_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participante_transferencias_turma_destino_id_fkey"
            columns: ["turma_destino_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participante_transferencias_turma_origem_id_fkey"
            columns: ["turma_origem_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      participantes: {
        Row: {
          bairro_id: string | null
          categoria_vulnerabilidade: string | null
          cor_raca: string | null
          cpf: string | null
          created_at: string | null
          data_desligamento: string | null
          data_nascimento: string | null
          dias_contraturno: string | null
          endereco_bairro: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          escola: string | null
          foto_url: string | null
          genero: string | null
          id: string
          iniciou_em: string | null
          is_teste: boolean
          justificativa_desligamento: string | null
          laudo: string | null
          motivo_desligamento: string | null
          nome_completo: string
          observacoes_sigilosas: string | null
          origem_encaminhamento: string | null
          outras_condicoes: string | null
          periodo: Database["public"]["Enums"]["periodo_enum"] | null
          ponto_transporte_id: string | null
          remedio_continuo: string | null
          responsavel_tecnico: string | null
          responsavel1_cpf: string | null
          responsavel1_nome: string | null
          responsavel1_whatsapp: string | null
          responsavel2_nome: string | null
          responsavel2_whatsapp: string | null
          restricao_alimentar: string | null
          serie: string | null
          situacao_moradia: string | null
          status: Database["public"]["Enums"]["status_participante"] | null
          uf_origem: string | null
          updated_at: string | null
          vinculo_resp1: string | null
          vinculo_resp2: string | null
          visualizado_em: string | null
        }
        Insert: {
          bairro_id?: string | null
          categoria_vulnerabilidade?: string | null
          cor_raca?: string | null
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          dias_contraturno?: string | null
          endereco_bairro?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          escola?: string | null
          foto_url?: string | null
          genero?: string | null
          id?: string
          iniciou_em?: string | null
          is_teste?: boolean
          justificativa_desligamento?: string | null
          laudo?: string | null
          motivo_desligamento?: string | null
          nome_completo: string
          observacoes_sigilosas?: string | null
          origem_encaminhamento?: string | null
          outras_condicoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          ponto_transporte_id?: string | null
          remedio_continuo?: string | null
          responsavel_tecnico?: string | null
          responsavel1_cpf?: string | null
          responsavel1_nome?: string | null
          responsavel1_whatsapp?: string | null
          responsavel2_nome?: string | null
          responsavel2_whatsapp?: string | null
          restricao_alimentar?: string | null
          serie?: string | null
          situacao_moradia?: string | null
          status?: Database["public"]["Enums"]["status_participante"] | null
          uf_origem?: string | null
          updated_at?: string | null
          vinculo_resp1?: string | null
          vinculo_resp2?: string | null
          visualizado_em?: string | null
        }
        Update: {
          bairro_id?: string | null
          categoria_vulnerabilidade?: string | null
          cor_raca?: string | null
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          dias_contraturno?: string | null
          endereco_bairro?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          escola?: string | null
          foto_url?: string | null
          genero?: string | null
          id?: string
          iniciou_em?: string | null
          is_teste?: boolean
          justificativa_desligamento?: string | null
          laudo?: string | null
          motivo_desligamento?: string | null
          nome_completo?: string
          observacoes_sigilosas?: string | null
          origem_encaminhamento?: string | null
          outras_condicoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          ponto_transporte_id?: string | null
          remedio_continuo?: string | null
          responsavel_tecnico?: string | null
          responsavel1_cpf?: string | null
          responsavel1_nome?: string | null
          responsavel1_whatsapp?: string | null
          responsavel2_nome?: string | null
          responsavel2_whatsapp?: string | null
          restricao_alimentar?: string | null
          serie?: string | null
          situacao_moradia?: string | null
          status?: Database["public"]["Enums"]["status_participante"] | null
          uf_origem?: string | null
          updated_at?: string | null
          vinculo_resp1?: string | null
          vinculo_resp2?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participantes_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participantes_ponto_transporte_id_fkey"
            columns: ["ponto_transporte_id"]
            isOneToOne: false
            referencedRelation: "pontos_transporte"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamento_turmas: {
        Row: {
          id: string
          planejamento_id: string
          turma_id: string
        }
        Insert: {
          id?: string
          planejamento_id: string
          turma_id: string
        }
        Update: {
          id?: string
          planejamento_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_turmas_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planejamento_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamentos: {
        Row: {
          apoio_tecnico: string | null
          created_at: string | null
          data_aplicacao: string | null
          drive_file_id: string | null
          drive_url: string | null
          educador_id: string | null
          forma_avaliacao: string[] | null
          id: string
          materiais: string | null
          objetivos: string | null
          questao_geradora: string | null
          roteiro: string | null
          tema: string | null
          tipo_atividade: string[] | null
          tipo_atividade_detalhe: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          apoio_tecnico?: string | null
          created_at?: string | null
          data_aplicacao?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          educador_id?: string | null
          forma_avaliacao?: string[] | null
          id?: string
          materiais?: string | null
          objetivos?: string | null
          questao_geradora?: string | null
          roteiro?: string | null
          tema?: string | null
          tipo_atividade?: string[] | null
          tipo_atividade_detalhe?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          apoio_tecnico?: string | null
          created_at?: string | null
          data_aplicacao?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          educador_id?: string | null
          forma_avaliacao?: string[] | null
          id?: string
          materiais?: string | null
          objetivos?: string | null
          questao_geradora?: string | null
          roteiro?: string | null
          tema?: string | null
          tipo_atividade?: string[] | null
          tipo_atividade_detalhe?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planejamentos_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planejamentos_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_transporte: {
        Row: {
          ativo: boolean | null
          bairro_id: string | null
          horario_manha: string | null
          horario_tarde: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean | null
          bairro_id?: string | null
          horario_manha?: string | null
          horario_tarde?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean | null
          bairro_id?: string | null
          horario_manha?: string | null
          horario_tarde?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "pontos_transporte_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
        ]
      }
      presenca: {
        Row: {
          created_at: string | null
          data: string
          id: string
          justificativa: string | null
          participante_id: string
          presente: boolean | null
          registrado_por: string | null
          turma_id: string
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: string
          justificativa?: string | null
          participante_id: string
          presente?: boolean | null
          registrado_por?: string | null
          turma_id: string
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          justificativa?: string | null
          participante_id?: string
          presente?: boolean | null
          registrado_por?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenca_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presenca_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean | null
          carga_horaria: string | null
          cargo: string | null
          cpf: string | null
          created_at: string | null
          data_desligamento: string | null
          data_inicio: string | null
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          registro_profissional: string | null
          rg: string | null
          rg_data_expedicao: string | null
          rg_orgao_expedidor: string | null
          salario: number | null
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          carga_horaria?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          data_inicio?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          registro_profissional?: string | null
          rg?: string | null
          rg_data_expedicao?: string | null
          rg_orgao_expedidor?: string | null
          salario?: number | null
          telefone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          carga_horaria?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          data_desligamento?: string | null
          data_inicio?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          registro_profissional?: string | null
          rg?: string | null
          rg_data_expedicao?: string | null
          rg_orgao_expedidor?: string | null
          salario?: number | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      projeto_colunas: {
        Row: {
          cor: string | null
          created_at: string
          id: string
          is_concluido: boolean
          nome: string
          ordem: number
          projeto_id: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          id?: string
          is_concluido?: boolean
          nome: string
          ordem?: number
          projeto_id: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          id?: string
          is_concluido?: boolean
          nome?: string
          ordem?: number
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_colunas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_membros: {
        Row: {
          created_at: string
          papel: string
          profile_id: string
          projeto_id: string
        }
        Insert: {
          created_at?: string
          papel?: string
          profile_id: string
          projeto_id: string
        }
        Update: {
          created_at?: string
          papel?: string
          profile_id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_membros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_membros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_membros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_anexos: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          mime: string | null
          nome: string
          storage_path: string
          tamanho: number | null
          tarefa_id: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          mime?: string | null
          nome: string
          storage_path: string
          tamanho?: number | null
          tarefa_id: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          mime?: string | null
          nome?: string
          storage_path?: string
          tamanho?: number | null
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_anexos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefa_anexos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefa_anexos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_checklist: {
        Row: {
          concluido: boolean
          created_at: string
          id: string
          ordem: number
          tarefa_id: string
          texto: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          tarefa_id: string
          texto: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          tarefa_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_checklist_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_comentarios: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          tarefa_id: string
          texto: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          tarefa_id: string
          texto: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          tarefa_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefa_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefa_dependencias: {
        Row: {
          created_at: string
          depende_de_id: string
          tarefa_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          depende_de_id: string
          tarefa_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          depende_de_id?: string
          tarefa_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefa_dependencias_depende_de_id_fkey"
            columns: ["depende_de_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefa_dependencias_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "projeto_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_tarefas: {
        Row: {
          coluna_id: string
          concluido_em: string | null
          created_at: string
          criador_id: string
          data_inicio: string | null
          descricao: string | null
          duracao_estimada_horas: number | null
          id: string
          ordem_kanban: number
          prazo: string | null
          prioridade: string
          progresso_pct: number
          projeto_id: string
          responsavel_id: string | null
          tags: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          coluna_id: string
          concluido_em?: string | null
          created_at?: string
          criador_id: string
          data_inicio?: string | null
          descricao?: string | null
          duracao_estimada_horas?: number | null
          id?: string
          ordem_kanban?: number
          prazo?: string | null
          prioridade?: string
          progresso_pct?: number
          projeto_id: string
          responsavel_id?: string | null
          tags?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          coluna_id?: string
          concluido_em?: string | null
          created_at?: string
          criador_id?: string
          data_inicio?: string | null
          descricao?: string | null
          duracao_estimada_horas?: number | null
          id?: string
          ordem_kanban?: number
          prazo?: string | null
          prioridade?: string
          progresso_pct?: number
          projeto_id?: string
          responsavel_id?: string | null
          tags?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefas_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "projeto_colunas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_criador_id_fkey"
            columns: ["criador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_criador_id_fkey"
            columns: ["criador_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          cor: string
          created_at: string
          data_fim_prevista: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      recados: {
        Row: {
          ciente: boolean
          conteudo: string
          created_at: string
          destinatario_id: string
          id: string
          lido: boolean
          numero: number
          participante_id: string | null
          remetente_id: string
          status: string
          tipo_recado: string
        }
        Insert: {
          ciente?: boolean
          conteudo: string
          created_at?: string
          destinatario_id: string
          id?: string
          lido?: boolean
          numero?: number
          participante_id?: string | null
          remetente_id: string
          status?: string
          tipo_recado?: string
        }
        Update: {
          ciente?: boolean
          conteudo?: string
          created_at?: string
          destinatario_id?: string
          id?: string
          lido?: boolean
          numero?: number
          participante_id?: string | null
          remetente_id?: string
          status?: string
          tipo_recado?: string
        }
        Relationships: [
          {
            foreignKeyName: "recados_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recados_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recados_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recados_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recados_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      recados_familia: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          lido_em: string | null
          participante_id: string
          remetente_id: string
          updated_at: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          lido_em?: string | null
          participante_id: string
          remetente_id: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          lido_em?: string | null
          participante_id?: string
          remetente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recados_familia_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recados_familia_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recados_familia_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      relato_equipe_participantes: {
        Row: {
          id: string
          participante_id: string
          relato_id: string
        }
        Insert: {
          id?: string
          participante_id: string
          relato_id: string
        }
        Update: {
          id?: string
          participante_id?: string
          relato_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relato_equipe_participantes_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relato_equipe_participantes_relato_id_fkey"
            columns: ["relato_id"]
            isOneToOne: false
            referencedRelation: "relato_equipe_tecnica"
            referencedColumns: ["id"]
          },
        ]
      }
      relato_equipe_tecnica: {
        Row: {
          created_at: string
          criado_por: string | null
          descricao: string
          id: string
          motivo: string
          relatorio_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          motivo: string
          relatorio_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          motivo?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relato_equipe_tecnica_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relato_equipe_tecnica_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relato_equipe_tecnica_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_fotos: {
        Row: {
          drive_file_id: string | null
          drive_url: string | null
          exif_metadata: Json | null
          foto_url: string
          id: string
          ordem: number | null
          relatorio_id: string
          veracidade_hash: string | null
        }
        Insert: {
          drive_file_id?: string | null
          drive_url?: string | null
          exif_metadata?: Json | null
          foto_url: string
          id?: string
          ordem?: number | null
          relatorio_id: string
          veracidade_hash?: string | null
        }
        Update: {
          drive_file_id?: string | null
          drive_url?: string | null
          exif_metadata?: Json | null
          foto_url?: string
          id?: string
          ordem?: number | null
          relatorio_id?: string
          veracidade_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_fotos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_presenca: {
        Row: {
          id: string
          justificativa: string | null
          nome_avulso: string | null
          participante_id: string | null
          presente: boolean | null
          relatorio_id: string
        }
        Insert: {
          id?: string
          justificativa?: string | null
          nome_avulso?: string | null
          participante_id?: string | null
          presente?: boolean | null
          relatorio_id: string
        }
        Update: {
          id?: string
          justificativa?: string | null
          nome_avulso?: string | null
          participante_id?: string | null
          presente?: boolean | null
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_presenca_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_presenca_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_turmas: {
        Row: {
          id: string
          relatorio_id: string
          turma_id: string
        }
        Insert: {
          id?: string
          relatorio_id: string
          turma_id: string
        }
        Update: {
          id?: string
          relatorio_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_turmas_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atividade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_turmas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_atividade: {
        Row: {
          analise_ia: string | null
          autonomia: number | null
          colaboracao: number | null
          comunicacao: number | null
          created_at: string | null
          data: string
          dia_semana: string | null
          drive_file_id: string | null
          drive_url: string | null
          educador_apoio_id: string | null
          educador_id: string | null
          engajamento: string[] | null
          gdoc_id: string | null
          gdoc_url: string | null
          id: string
          iniciativa: number | null
          intervencoes: string | null
          nome_atividade: string | null
          num_ausentes: number | null
          num_matriculados: number | null
          num_participantes: number | null
          objetivo_alcancado:
            | Database["public"]["Enums"]["objetivo_resultado"]
            | null
          observacoes: string | null
          pct_adesao: number | null
          periodo_atividade: string | null
          planejamento_id: string | null
          respeito_mutuo: number | null
          score_elo: number | null
          situacoes_relevantes: string[] | null
          tipo_atividade: string[] | null
          tipo_atividade_detalhe: string | null
        }
        Insert: {
          analise_ia?: string | null
          autonomia?: number | null
          colaboracao?: number | null
          comunicacao?: number | null
          created_at?: string | null
          data: string
          dia_semana?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          educador_apoio_id?: string | null
          educador_id?: string | null
          engajamento?: string[] | null
          gdoc_id?: string | null
          gdoc_url?: string | null
          id?: string
          iniciativa?: number | null
          intervencoes?: string | null
          nome_atividade?: string | null
          num_ausentes?: number | null
          num_matriculados?: number | null
          num_participantes?: number | null
          objetivo_alcancado?:
            | Database["public"]["Enums"]["objetivo_resultado"]
            | null
          observacoes?: string | null
          pct_adesao?: number | null
          periodo_atividade?: string | null
          planejamento_id?: string | null
          respeito_mutuo?: number | null
          score_elo?: number | null
          situacoes_relevantes?: string[] | null
          tipo_atividade?: string[] | null
          tipo_atividade_detalhe?: string | null
        }
        Update: {
          analise_ia?: string | null
          autonomia?: number | null
          colaboracao?: number | null
          comunicacao?: number | null
          created_at?: string | null
          data?: string
          dia_semana?: string | null
          drive_file_id?: string | null
          drive_url?: string | null
          educador_apoio_id?: string | null
          educador_id?: string | null
          engajamento?: string[] | null
          gdoc_id?: string | null
          gdoc_url?: string | null
          id?: string
          iniciativa?: number | null
          intervencoes?: string | null
          nome_atividade?: string | null
          num_ausentes?: number | null
          num_matriculados?: number | null
          num_participantes?: number | null
          objetivo_alcancado?:
            | Database["public"]["Enums"]["objetivo_resultado"]
            | null
          observacoes?: string | null
          pct_adesao?: number | null
          periodo_atividade?: string | null
          planejamento_id?: string | null
          respeito_mutuo?: number | null
          score_elo?: number | null
          situacoes_relevantes?: string[] | null
          tipo_atividade?: string[] | null
          tipo_atividade_detalhe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_atividade_educador_apoio_id_fkey"
            columns: ["educador_apoio_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_atividade_educador_apoio_id_fkey"
            columns: ["educador_apoio_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_atividade_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_atividade_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_atividade_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      roteiro_visitas: {
        Row: {
          atendimento_id: string | null
          bairro_nome: string | null
          created_at: string
          horario_realizado: string | null
          id: string
          ordem: number
          origem: string
          participante_id: string
          relato: string | null
          roteiro_id: string
          status_visita: string
          updated_at: string
        }
        Insert: {
          atendimento_id?: string | null
          bairro_nome?: string | null
          created_at?: string
          horario_realizado?: string | null
          id?: string
          ordem?: number
          origem?: string
          participante_id: string
          relato?: string | null
          roteiro_id: string
          status_visita?: string
          updated_at?: string
        }
        Update: {
          atendimento_id?: string | null
          bairro_nome?: string | null
          created_at?: string
          horario_realizado?: string | null
          id?: string
          ordem?: number
          origem?: string
          participante_id?: string
          relato?: string | null
          roteiro_id?: string
          status_visita?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roteiro_visitas_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "roteiros_visita"
            referencedColumns: ["id"]
          },
        ]
      }
      roteiros_visita: {
        Row: {
          concluido_em: string | null
          created_at: string
          criado_por: string | null
          data_visita: string
          drive_file_id: string | null
          drive_url: string | null
          horario_saida: string | null
          id: string
          observacoes: string | null
          responsaveis: string[] | null
          status: string
          titulo: string
          updated_at: string
          veiculo: string | null
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_visita: string
          drive_file_id?: string | null
          drive_url?: string | null
          horario_saida?: string | null
          id?: string
          observacoes?: string | null
          responsaveis?: string[] | null
          status?: string
          titulo: string
          updated_at?: string
          veiculo?: string | null
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_visita?: string
          drive_file_id?: string | null
          drive_url?: string | null
          horario_saida?: string | null
          id?: string
          observacoes?: string | null
          responsaveis?: string[] | null
          status?: string
          titulo?: string
          updated_at?: string
          veiculo?: string | null
        }
        Relationships: []
      }
      sit_codigos: {
        Row: {
          ativo: boolean
          categoria: string
          codigo: string
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo: string
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      sit_configuracao: {
        Row: {
          ano_transferencia_padrao: number
          banco_agencia: string | null
          banco_codigo: string | null
          banco_conta: string | null
          banco_nome: string | null
          banco_tipo_conta: string | null
          cnpj_concedente: string
          cnpj_osc: string | null
          created_at: string
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          exercicio: number | null
          gestor_cargo: string | null
          gestor_cpf: string | null
          gestor_email: string | null
          gestor_nome: string | null
          id: string
          modalidade_compra_padrao: number
          numero_instrumento_padrao: string
          objeto_termo: string | null
          observacoes: string | null
          razao_social_concedente: string | null
          razao_social_osc: string | null
          tipo_doc_pagamento_padrao: number
          tipo_transferencia_padrao: number
          updated_at: string
          valor_total_repasse: number | null
        }
        Insert: {
          ano_transferencia_padrao?: number
          banco_agencia?: string | null
          banco_codigo?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          cnpj_concedente: string
          cnpj_osc?: string | null
          created_at?: string
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          exercicio?: number | null
          gestor_cargo?: string | null
          gestor_cpf?: string | null
          gestor_email?: string | null
          gestor_nome?: string | null
          id?: string
          modalidade_compra_padrao?: number
          numero_instrumento_padrao: string
          objeto_termo?: string | null
          observacoes?: string | null
          razao_social_concedente?: string | null
          razao_social_osc?: string | null
          tipo_doc_pagamento_padrao?: number
          tipo_transferencia_padrao?: number
          updated_at?: string
          valor_total_repasse?: number | null
        }
        Update: {
          ano_transferencia_padrao?: number
          banco_agencia?: string | null
          banco_codigo?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          cnpj_concedente?: string
          cnpj_osc?: string | null
          created_at?: string
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          exercicio?: number | null
          gestor_cargo?: string | null
          gestor_cpf?: string | null
          gestor_email?: string | null
          gestor_nome?: string | null
          id?: string
          modalidade_compra_padrao?: number
          numero_instrumento_padrao?: string
          objeto_termo?: string | null
          observacoes?: string | null
          razao_social_concedente?: string | null
          razao_social_osc?: string | null
          tipo_doc_pagamento_padrao?: number
          tipo_transferencia_padrao?: number
          updated_at?: string
          valor_total_repasse?: number | null
        }
        Relationships: []
      }
      site_conteudos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          descricao: string | null
          id: string
          thumbnail_url: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          thumbnail_url?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          thumbnail_url?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      site_horarios_disponiveis: {
        Row: {
          ativo: boolean | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
        }
        Insert: {
          ativo?: boolean | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
        }
        Update: {
          ativo?: boolean | null
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
        }
        Relationships: []
      }
      site_leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          interesse: string | null
          nome: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          interesse?: string | null
          nome: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          interesse?: string | null
          nome?: string
        }
        Relationships: []
      }
      site_noticias: {
        Row: {
          autor_id: string | null
          conteudo: string
          created_at: string | null
          id: string
          imagem_url: string | null
          published_at: string | null
          relatorio_id: string | null
          status: string
          subtitulo: string | null
          titulo: string
        }
        Insert: {
          autor_id?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          imagem_url?: string | null
          published_at?: string | null
          relatorio_id?: string | null
          status?: string
          subtitulo?: string | null
          titulo: string
        }
        Update: {
          autor_id?: string | null
          conteudo?: string
          created_at?: string | null
          id?: string
          imagem_url?: string | null
          published_at?: string | null
          relatorio_id?: string | null
          status?: string
          subtitulo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_noticias_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_noticias_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_noticias_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_atividade"
            referencedColumns: ["id"]
          },
        ]
      }
      site_reunioes: {
        Row: {
          assunto: string
          created_at: string | null
          data_hora: string
          email: string
          google_meet_link: string | null
          id: string
          nome: string
          status: string
          telefone: string | null
        }
        Insert: {
          assunto: string
          created_at?: string | null
          data_hora: string
          email: string
          google_meet_link?: string | null
          id?: string
          nome: string
          status?: string
          telefone?: string | null
        }
        Update: {
          assunto?: string
          created_at?: string | null
          data_hora?: string
          email?: string
          google_meet_link?: string | null
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
        }
        Relationships: []
      }
      template_tag_mappings: {
        Row: {
          created_at: string | null
          data_field: string
          id: string
          tag_name: string
          template_key: string
        }
        Insert: {
          created_at?: string | null
          data_field: string
          id?: string
          tag_name: string
          template_key: string
        }
        Update: {
          created_at?: string | null
          data_field?: string
          id?: string
          tag_name?: string
          template_key?: string
        }
        Relationships: []
      }
      turma_participantes: {
        Row: {
          data_entrada: string
          data_saida: string | null
          id: string
          motivo_saida: string | null
          participante_id: string
          periodo_override: Database["public"]["Enums"]["periodo_enum"] | null
          turma_id: string
        }
        Insert: {
          data_entrada?: string
          data_saida?: string | null
          id?: string
          motivo_saida?: string | null
          participante_id: string
          periodo_override?: Database["public"]["Enums"]["periodo_enum"] | null
          turma_id: string
        }
        Update: {
          data_entrada?: string
          data_saida?: string | null
          id?: string
          motivo_saida?: string | null
          participante_id?: string
          periodo_override?: Database["public"]["Enums"]["periodo_enum"] | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_participantes_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_participantes_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          ativa: boolean | null
          bairro_id: string | null
          bairro_ids: string[] | null
          created_at: string | null
          dias_semana: string[] | null
          educador_id: string | null
          faixa_etaria: Database["public"]["Enums"]["faixa_etaria_enum"] | null
          faixas_etarias: string[] | null
          id: string
          nome: string
          nome_grupo: string | null
          oficina: string | null
          periodo: Database["public"]["Enums"]["periodo_enum"] | null
          tipo: Database["public"]["Enums"]["tipo_turma"] | null
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          bairro_id?: string | null
          bairro_ids?: string[] | null
          created_at?: string | null
          dias_semana?: string[] | null
          educador_id?: string | null
          faixa_etaria?: Database["public"]["Enums"]["faixa_etaria_enum"] | null
          faixas_etarias?: string[] | null
          id?: string
          nome: string
          nome_grupo?: string | null
          oficina?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          tipo?: Database["public"]["Enums"]["tipo_turma"] | null
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          bairro_id?: string | null
          bairro_ids?: string[] | null
          created_at?: string | null
          dias_semana?: string[] | null
          educador_id?: string | null
          faixa_etaria?: Database["public"]["Enums"]["faixa_etaria_enum"] | null
          faixas_etarias?: string[] | null
          id?: string
          nome?: string
          nome_grupo?: string | null
          oficina?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          tipo?: Database["public"]["Enums"]["tipo_turma"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turmas_bairro_id_fkey"
            columns: ["bairro_id"]
            isOneToOne: false
            referencedRelation: "bairros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turmas_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          created_at: string | null
          foto_url: string | null
          id: string | null
          nome: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          foto_url?: string | null
          id?: string | null
          nome?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          foto_url?: string | null
          id?: string | null
          nome?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      criar_projeto: {
        Args: {
          _cor?: string
          _data_fim_prevista?: string
          _data_inicio?: string
          _descricao?: string
          _membros_ids?: string[]
          _nome: string
        }
        Returns: string
      }
      enqueue_drive_sync: {
        Args: { _origem_id: string; _tipo: string }
        Returns: undefined
      }
      find_fuzzy_participant: {
        Args: { _data_nascimento: string; _nome: string }
        Returns: {
          id: string
          nome_completo: string
          sim: number
        }[]
      }
      find_similar_participants: {
        Args: never
        Returns: {
          data_nascimento: string
          id1: string
          id2: string
          nome1: string
          nome2: string
          similaridade: number
          status1: string
          status2: string
        }[]
      }
      fn_enqueue_drive_sync: {
        Args: { _origem_id: string; _tipo: string }
        Returns: undefined
      }
      get_coordenacao_stats: {
        Args: { _periodo_dias?: number; _user_id?: string }
        Returns: Json
      }
      get_cozinha_stats: { Args: never; Returns: Json }
      get_dashboard_stats:
        | { Args: { _ano?: number; _mes?: number }; Returns: Json }
        | {
            Args: {
              _ano?: number
              _data_fim?: string
              _data_inicio?: string
              _mes?: number
            }
            Returns: Json
          }
      get_pendencias_integridade: { Args: never; Returns: Json }
      get_pendencias_integridade_detalhes: { Args: never; Returns: Json }
      get_profile_full: {
        Args: { _profile_id: string }
        Returns: {
          ativo: boolean | null
          carga_horaria: string | null
          cargo: string | null
          cpf: string | null
          created_at: string | null
          data_desligamento: string | null
          data_inicio: string | null
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          registro_profissional: string | null
          rg: string | null
          rg_data_expedicao: string | null
          rg_orgao_expedidor: string | null
          salario: number | null
          telefone: string | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profile_sensitive: {
        Args: { _profile_id: string }
        Returns: {
          cpf: string
          data_desligamento: string
          data_inicio: string
          endereco: string
          id: string
          registro_profissional: string
          rg: string
          rg_data_expedicao: string
          rg_orgao_expedidor: string
          salario: number
          telefone: string
          user_id: string
        }[]
      }
      get_projeto_stats: { Args: { _projeto_id: string }; Returns: Json }
      get_restricoes_alimentares: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_projeto_member: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      list_profiles_rh: {
        Args: never
        Returns: {
          ativo: boolean
          carga_horaria: string
          cargo: string
          cpf: string
          data_desligamento: string
          data_inicio: string
          email: string
          endereco: string
          foto_url: string
          id: string
          nome: string
          registro_profissional: string
          rg: string
          rg_data_expedicao: string
          rg_orgao_expedidor: string
          salario: number
          telefone: string
          user_id: string
        }[]
      }
      projeto_member_papel: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: string
      }
      recalcular_busca_ativa: {
        Args: { _participante_ids?: string[] }
        Returns: Json
      }
      recalcular_vinculos_turmas: { Args: never; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      title_case_pt: { Args: { txt: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "coordenacao"
        | "educador"
        | "tecnico"
        | "motorista"
        | "cozinheiro"
        | "visitante"
        | "marketing"
      faixa_etaria_enum: "6-8" | "9-11" | "12-17" | "idosos"
      objetivo_resultado: "alcancado" | "parcial" | "nao_alcancado"
      periodo_enum: "manha" | "tarde" | "integral"
      status_participante:
        | "ativo"
        | "desligado"
        | "incompleto"
        | "pendente"
        | "busca_ativa"
      tipo_feed_post: "manual" | "relatorio_auto" | "conquista"
      tipo_mural: "aviso" | "lembrete" | "informativo"
      tipo_reacao: "like" | "amei"
      tipo_turma: "ordinaria" | "extraordinaria"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "coordenacao",
        "educador",
        "tecnico",
        "motorista",
        "cozinheiro",
        "visitante",
        "marketing",
      ],
      faixa_etaria_enum: ["6-8", "9-11", "12-17", "idosos"],
      objetivo_resultado: ["alcancado", "parcial", "nao_alcancado"],
      periodo_enum: ["manha", "tarde", "integral"],
      status_participante: [
        "ativo",
        "desligado",
        "incompleto",
        "pendente",
        "busca_ativa",
      ],
      tipo_feed_post: ["manual", "relatorio_auto", "conquista"],
      tipo_mural: ["aviso", "lembrete", "informativo"],
      tipo_reacao: ["like", "amei"],
      tipo_turma: ["ordinaria", "extraordinaria"],
    },
  },
} as const
