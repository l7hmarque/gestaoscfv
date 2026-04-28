-- =====================================================
-- HUB DE PROJETOS & TAREFAS
-- =====================================================

-- ===== Tabela: projetos =====
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','concluido','arquivado')),
  cor text NOT NULL DEFAULT '#64748b',
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  data_inicio date,
  data_fim_prevista date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projetos_owner ON public.projetos(owner_id);
CREATE INDEX idx_projetos_status ON public.projetos(status);

-- ===== Tabela: projeto_membros =====
CREATE TABLE public.projeto_membros (
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('owner','membro','observador')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (projeto_id, profile_id)
);
CREATE INDEX idx_projeto_membros_profile ON public.projeto_membros(profile_id);

-- ===== Função auxiliar: é membro do projeto =====
CREATE OR REPLACE FUNCTION public.is_projeto_member(_projeto_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    JOIN public.profiles p ON p.id = pm.profile_id
    WHERE pm.projeto_id = _projeto_id AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.projeto_member_papel(_projeto_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.papel FROM public.projeto_membros pm
  JOIN public.profiles p ON p.id = pm.profile_id
  WHERE pm.projeto_id = _projeto_id AND p.user_id = _user_id
  LIMIT 1;
$$;

-- ===== Tabela: projeto_colunas =====
CREATE TABLE public.projeto_colunas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  cor text DEFAULT '#94a3b8',
  is_concluido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projeto_colunas_projeto ON public.projeto_colunas(projeto_id, ordem);

-- ===== Tabela: projeto_tarefas =====
CREATE TABLE public.projeto_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  coluna_id uuid NOT NULL REFERENCES public.projeto_colunas(id) ON DELETE RESTRICT,
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  data_inicio date,
  prazo date,
  duracao_estimada_horas numeric(6,2),
  progresso_pct int NOT NULL DEFAULT 0 CHECK (progresso_pct BETWEEN 0 AND 100),
  ordem_kanban int NOT NULL DEFAULT 0,
  tags text[] DEFAULT '{}',
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projeto_tarefas_projeto ON public.projeto_tarefas(projeto_id);
CREATE INDEX idx_projeto_tarefas_coluna ON public.projeto_tarefas(coluna_id, ordem_kanban);
CREATE INDEX idx_projeto_tarefas_resp ON public.projeto_tarefas(responsavel_id);
CREATE INDEX idx_projeto_tarefas_prazo ON public.projeto_tarefas(prazo);

-- ===== Tabela: projeto_tarefa_dependencias =====
CREATE TABLE public.projeto_tarefa_dependencias (
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  depende_de_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'FS' CHECK (tipo IN ('FS','SS','FF','SF')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, depende_de_id),
  CHECK (tarefa_id <> depende_de_id)
);
CREATE INDEX idx_dep_depende_de ON public.projeto_tarefa_dependencias(depende_de_id);

-- Trigger anti-ciclo
CREATE OR REPLACE FUNCTION public.fn_check_dep_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existe boolean;
BEGIN
  WITH RECURSIVE chain AS (
    SELECT depende_de_id FROM public.projeto_tarefa_dependencias WHERE tarefa_id = NEW.depende_de_id
    UNION
    SELECT d.depende_de_id FROM public.projeto_tarefa_dependencias d
    JOIN chain c ON d.tarefa_id = c.depende_de_id
  )
  SELECT EXISTS (SELECT 1 FROM chain WHERE depende_de_id = NEW.tarefa_id) INTO v_existe;
  IF v_existe THEN
    RAISE EXCEPTION 'Dependência cria ciclo entre tarefas (não permitido).';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_check_dep_ciclo
  BEFORE INSERT OR UPDATE ON public.projeto_tarefa_dependencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_dep_ciclo();

-- ===== Tabela: projeto_tarefa_checklist =====
CREATE TABLE public.projeto_tarefa_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_tarefa ON public.projeto_tarefa_checklist(tarefa_id, ordem);

-- ===== Tabela: projeto_tarefa_comentarios =====
CREATE TABLE public.projeto_tarefa_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_comentarios_tarefa ON public.projeto_tarefa_comentarios(tarefa_id, created_at);

-- ===== Tabela: projeto_tarefa_anexos =====
CREATE TABLE public.projeto_tarefa_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text NOT NULL,
  mime text,
  tamanho int,
  autor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_anexos_tarefa ON public.projeto_tarefa_anexos(tarefa_id);

-- ===== Triggers updated_at =====
CREATE TRIGGER trg_projetos_updated BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_projeto_tarefas_updated BEFORE UPDATE ON public.projeto_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== ENABLE RLS =====
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_colunas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefa_dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefa_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefa_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefa_anexos ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES: projetos =====
CREATE POLICY "Membros e coord veem projetos" ON public.projetos FOR SELECT TO authenticated
  USING (public.is_projeto_member(id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role));
CREATE POLICY "Qualquer profissional cria projeto" ON public.projetos FOR INSERT TO authenticated
  WITH CHECK (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Owner ou coord edita projeto" ON public.projetos FOR UPDATE TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'coordenacao'::app_role)
  );
CREATE POLICY "Owner ou coord exclui projeto" ON public.projetos FOR DELETE TO authenticated
  USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'coordenacao'::app_role)
  );

-- ===== POLICIES: projeto_membros =====
CREATE POLICY "Membros veem outros membros" ON public.projeto_membros FOR SELECT TO authenticated
  USING (public.is_projeto_member(projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role));
CREATE POLICY "Owner ou coord gerencia membros" ON public.projeto_membros FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.id = projeto_id
        AND (
          p.owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR public.has_role(auth.uid(), 'coordenacao'::app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.id = projeto_id
        AND (
          p.owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR public.has_role(auth.uid(), 'coordenacao'::app_role)
        )
    )
  );

-- ===== POLICIES: projeto_colunas =====
CREATE POLICY "Membros veem colunas" ON public.projeto_colunas FOR SELECT TO authenticated
  USING (public.is_projeto_member(projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role));
CREATE POLICY "Membros gerenciam colunas" ON public.projeto_colunas FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR COALESCE(public.projeto_member_papel(projeto_id, auth.uid()) IN ('owner','membro'), false)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR COALESCE(public.projeto_member_papel(projeto_id, auth.uid()) IN ('owner','membro'), false)
  );

-- ===== POLICIES: projeto_tarefas =====
CREATE POLICY "Membros veem tarefas" ON public.projeto_tarefas FOR SELECT TO authenticated
  USING (public.is_projeto_member(projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role));
CREATE POLICY "Membros gerenciam tarefas" ON public.projeto_tarefas FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR COALESCE(public.projeto_member_papel(projeto_id, auth.uid()) IN ('owner','membro'), false)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coordenacao'::app_role)
    OR COALESCE(public.projeto_member_papel(projeto_id, auth.uid()) IN ('owner','membro'), false)
  );

-- ===== POLICIES: dependencias / checklist / comentarios / anexos =====
CREATE POLICY "Membros veem deps" ON public.projeto_tarefa_dependencias FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.is_projeto_member(t.projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role))));
CREATE POLICY "Membros editam deps" ON public.projeto_tarefa_dependencias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))));

CREATE POLICY "Membros veem checklist" ON public.projeto_tarefa_checklist FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.is_projeto_member(t.projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role))));
CREATE POLICY "Membros editam checklist" ON public.projeto_tarefa_checklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))));

CREATE POLICY "Membros veem comentarios" ON public.projeto_tarefa_comentarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.is_projeto_member(t.projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role))));
CREATE POLICY "Membros criam comentarios" ON public.projeto_tarefa_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR public.is_projeto_member(t.projeto_id, auth.uid())))
  );
CREATE POLICY "Autor edita proprio comentario" ON public.projeto_tarefa_comentarios FOR UPDATE TO authenticated
  USING (autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Autor ou coord exclui comentario" ON public.projeto_tarefa_comentarios FOR DELETE TO authenticated
  USING (autor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role));

CREATE POLICY "Membros veem anexos" ON public.projeto_tarefa_anexos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.is_projeto_member(t.projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role))));
CREATE POLICY "Membros gerenciam anexos" ON public.projeto_tarefa_anexos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projeto_tarefas t WHERE t.id = tarefa_id AND (public.has_role(auth.uid(), 'coordenacao'::app_role) OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))));

-- ===== Função: criar projeto com colunas padrão e owner como membro =====
CREATE OR REPLACE FUNCTION public.criar_projeto(
  _nome text,
  _descricao text DEFAULT NULL,
  _cor text DEFAULT '#64748b',
  _data_inicio date DEFAULT NULL,
  _data_fim_prevista date DEFAULT NULL,
  _membros_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_projeto_id uuid;
  v_membro uuid;
BEGIN
  SELECT id INTO v_owner_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário.';
  END IF;

  INSERT INTO public.projetos (nome, descricao, cor, owner_id, data_inicio, data_fim_prevista)
  VALUES (_nome, _descricao, COALESCE(_cor,'#64748b'), v_owner_id, _data_inicio, _data_fim_prevista)
  RETURNING id INTO v_projeto_id;

  INSERT INTO public.projeto_membros (projeto_id, profile_id, papel)
  VALUES (v_projeto_id, v_owner_id, 'owner');

  IF _membros_ids IS NOT NULL THEN
    FOREACH v_membro IN ARRAY _membros_ids LOOP
      IF v_membro <> v_owner_id THEN
        INSERT INTO public.projeto_membros (projeto_id, profile_id, papel)
        VALUES (v_projeto_id, v_membro, 'membro')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.projeto_colunas (projeto_id, nome, ordem, cor, is_concluido) VALUES
    (v_projeto_id, 'A Fazer', 0, '#94a3b8', false),
    (v_projeto_id, 'Em Andamento', 1, '#3b82f6', false),
    (v_projeto_id, 'Em Revisão', 2, '#f59e0b', false),
    (v_projeto_id, 'Concluído', 3, '#10b981', true);

  RETURN v_projeto_id;
END;
$$;

-- ===== Função: estatísticas do projeto =====
CREATE OR REPLACE FUNCTION public.get_projeto_stats(_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_concluidas int;
  v_atrasadas int;
  v_concluidas_mes int;
  v_por_resp jsonb;
  v_por_prioridade jsonb;
BEGIN
  IF NOT (public.is_projeto_member(_projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role)) THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  SELECT count(*) INTO v_total FROM public.projeto_tarefas WHERE projeto_id = _projeto_id;
  SELECT count(*) INTO v_concluidas FROM public.projeto_tarefas t
    JOIN public.projeto_colunas c ON c.id = t.coluna_id
    WHERE t.projeto_id = _projeto_id AND c.is_concluido = true;
  SELECT count(*) INTO v_atrasadas FROM public.projeto_tarefas t
    JOIN public.projeto_colunas c ON c.id = t.coluna_id
    WHERE t.projeto_id = _projeto_id AND c.is_concluido = false
      AND t.prazo IS NOT NULL AND t.prazo < current_date;
  SELECT count(*) INTO v_concluidas_mes FROM public.projeto_tarefas
    WHERE projeto_id = _projeto_id AND concluido_em >= date_trunc('month', current_date);

  SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', nome, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_por_resp
  FROM (
    SELECT COALESCE(p.nome, 'Sem responsável') AS nome, count(*) AS cnt
    FROM public.projeto_tarefas t
    LEFT JOIN public.profiles p ON p.id = t.responsavel_id
    WHERE t.projeto_id = _projeto_id
    GROUP BY p.nome
  ) sub;

  SELECT COALESCE(jsonb_object_agg(prioridade, cnt), '{}'::jsonb)
  INTO v_por_prioridade
  FROM (
    SELECT prioridade, count(*) AS cnt FROM public.projeto_tarefas
    WHERE projeto_id = _projeto_id GROUP BY prioridade
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'concluidas', v_concluidas,
    'abertas', v_total - v_concluidas,
    'atrasadas', v_atrasadas,
    'concluidas_mes', v_concluidas_mes,
    'pct_conclusao', CASE WHEN v_total > 0 THEN round((v_concluidas::numeric / v_total) * 100, 1) ELSE 0 END,
    'por_responsavel', v_por_resp,
    'por_prioridade', v_por_prioridade
  );
END;
$$;

-- ===== Storage bucket privado para anexos =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('projeto-anexos', 'projeto-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Membros leem anexos do projeto"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND EXISTS (
    SELECT 1 FROM public.projeto_tarefa_anexos a
    JOIN public.projeto_tarefas t ON t.id = a.tarefa_id
    WHERE a.storage_path = name
      AND (public.is_projeto_member(t.projeto_id, auth.uid()) OR public.has_role(auth.uid(), 'coordenacao'::app_role))
  )
);

CREATE POLICY "Membros enviam anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'projeto-anexos');

CREATE POLICY "Membros excluem anexos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND EXISTS (
    SELECT 1 FROM public.projeto_tarefa_anexos a
    JOIN public.projeto_tarefas t ON t.id = a.tarefa_id
    WHERE a.storage_path = name
      AND (public.has_role(auth.uid(), 'coordenacao'::app_role)
        OR COALESCE(public.projeto_member_papel(t.projeto_id, auth.uid()) IN ('owner','membro'), false))
  )
);