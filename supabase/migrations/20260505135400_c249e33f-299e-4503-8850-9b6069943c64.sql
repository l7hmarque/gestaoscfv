
-- Função de Title Case com conectores em minúsculo
CREATE OR REPLACE FUNCTION public.title_case_pt(txt text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  out_txt text;
BEGIN
  IF txt IS NULL OR btrim(txt) = '' THEN RETURN txt; END IF;
  out_txt := initcap(lower(txt));
  -- conectores em minúsculo (exceto se forem a primeira palavra)
  out_txt := regexp_replace(out_txt, '(\s)(De|Da|Do|Das|Dos|E|Em|Com|Para|Por)(\s|$)', '\1' || lower('\2') || '\3', 'g');
  -- segunda passada porque regex pode pular ocorrências sobrepostas
  out_txt := regexp_replace(out_txt, '(\s)(De|Da|Do|Das|Dos|E|Em|Com|Para|Por)(\s|$)', '\1' || lower('\2') || '\3', 'g');
  RETURN out_txt;
END;
$$;

-- Trigger de normalização
CREATE OR REPLACE FUNCTION public.normalize_participante_names()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome_completo IS NOT NULL THEN
    NEW.nome_completo := public.title_case_pt(NEW.nome_completo);
  END IF;
  IF NEW.responsavel1_nome IS NOT NULL THEN
    NEW.responsavel1_nome := public.title_case_pt(NEW.responsavel1_nome);
  END IF;
  IF NEW.responsavel2_nome IS NOT NULL THEN
    NEW.responsavel2_nome := public.title_case_pt(NEW.responsavel2_nome);
  END IF;
  IF NEW.escola IS NOT NULL THEN
    NEW.escola := public.title_case_pt(NEW.escola);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_participante_names ON public.participantes;
CREATE TRIGGER trg_normalize_participante_names
BEFORE INSERT OR UPDATE OF nome_completo, responsavel1_nome, responsavel2_nome, escola
ON public.participantes
FOR EACH ROW
EXECUTE FUNCTION public.normalize_participante_names();
