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
      bairros: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id?: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
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
      participantes: {
        Row: {
          bairro_id: string | null
          categoria_vulnerabilidade: string | null
          cor_raca: string | null
          created_at: string | null
          data_nascimento: string | null
          endereco_bairro: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          escola: string | null
          foto_url: string | null
          genero: string | null
          id: string
          iniciou_em: string | null
          laudo: string | null
          nome_completo: string
          observacoes_sigilosas: string | null
          origem_encaminhamento: string | null
          periodo: Database["public"]["Enums"]["periodo_enum"] | null
          ponto_transporte_id: string | null
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
          visualizado_em: string | null
        }
        Insert: {
          bairro_id?: string | null
          categoria_vulnerabilidade?: string | null
          cor_raca?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          endereco_bairro?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          escola?: string | null
          foto_url?: string | null
          genero?: string | null
          id?: string
          iniciou_em?: string | null
          laudo?: string | null
          nome_completo: string
          observacoes_sigilosas?: string | null
          origem_encaminhamento?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          ponto_transporte_id?: string | null
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
          visualizado_em?: string | null
        }
        Update: {
          bairro_id?: string | null
          categoria_vulnerabilidade?: string | null
          cor_raca?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          endereco_bairro?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          escola?: string | null
          foto_url?: string | null
          genero?: string | null
          id?: string
          iniciou_em?: string | null
          laudo?: string | null
          nome_completo?: string
          observacoes_sigilosas?: string | null
          origem_encaminhamento?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          ponto_transporte_id?: string | null
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
        }
        Insert: {
          ativo?: boolean | null
          bairro_id?: string | null
          horario_manha?: string | null
          horario_tarde?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          bairro_id?: string | null
          horario_manha?: string | null
          horario_tarde?: string | null
          id?: string
          nome?: string
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
          cargo: string | null
          cpf: string | null
          created_at: string | null
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
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
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
          telefone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
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
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      relatorio_fotos: {
        Row: {
          foto_url: string
          id: string
          ordem: number | null
          relatorio_id: string
        }
        Insert: {
          foto_url: string
          id?: string
          ordem?: number | null
          relatorio_id: string
        }
        Update: {
          foto_url?: string
          id?: string
          ordem?: number | null
          relatorio_id?: string
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
          participante_id: string
          presente: boolean | null
          relatorio_id: string
        }
        Insert: {
          id?: string
          justificativa?: string | null
          participante_id: string
          presente?: boolean | null
          relatorio_id: string
        }
        Update: {
          id?: string
          justificativa?: string | null
          participante_id?: string
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
          educador_id: string | null
          engajamento: string[] | null
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
          educador_id?: string | null
          engajamento?: string[] | null
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
          educador_id?: string | null
          engajamento?: string[] | null
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
          planejamento_id?: string | null
          respeito_mutuo?: number | null
          score_elo?: number | null
          situacoes_relevantes?: string[] | null
          tipo_atividade?: string[] | null
          tipo_atividade_detalhe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_atividade_educador_id_fkey"
            columns: ["educador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          id: string
          participante_id: string
          periodo_override: Database["public"]["Enums"]["periodo_enum"] | null
          turma_id: string
        }
        Insert: {
          id?: string
          participante_id: string
          periodo_override?: Database["public"]["Enums"]["periodo_enum"] | null
          turma_id: string
        }
        Update: {
          id?: string
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
          created_at: string | null
          dias_semana: string[] | null
          educador_id: string | null
          faixa_etaria: Database["public"]["Enums"]["faixa_etaria_enum"] | null
          id: string
          nome: string
          oficina: string | null
          periodo: Database["public"]["Enums"]["periodo_enum"] | null
          tipo: Database["public"]["Enums"]["tipo_turma"] | null
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          bairro_id?: string | null
          created_at?: string | null
          dias_semana?: string[] | null
          educador_id?: string | null
          faixa_etaria?: Database["public"]["Enums"]["faixa_etaria_enum"] | null
          id?: string
          nome: string
          oficina?: string | null
          periodo?: Database["public"]["Enums"]["periodo_enum"] | null
          tipo?: Database["public"]["Enums"]["tipo_turma"] | null
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          bairro_id?: string | null
          created_at?: string | null
          dias_semana?: string[] | null
          educador_id?: string | null
          faixa_etaria?: Database["public"]["Enums"]["faixa_etaria_enum"] | null
          id?: string
          nome?: string
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "coordenacao"
        | "educador"
        | "tecnico"
        | "motorista"
        | "cozinheiro"
        | "visitante"
      faixa_etaria_enum: "6-8" | "9-11" | "12-17" | "idosos"
      objetivo_resultado: "alcancado" | "parcial" | "nao_alcancado"
      periodo_enum: "manha" | "tarde" | "integral"
      status_participante: "ativo" | "desligado" | "incompleto" | "pendente"
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
      ],
      faixa_etaria_enum: ["6-8", "9-11", "12-17", "idosos"],
      objetivo_resultado: ["alcancado", "parcial", "nao_alcancado"],
      periodo_enum: ["manha", "tarde", "integral"],
      status_participante: ["ativo", "desligado", "incompleto", "pendente"],
      tipo_turma: ["ordinaria", "extraordinaria"],
    },
  },
} as const
