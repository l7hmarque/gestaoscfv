CREATE OR REPLACE FUNCTION public.fn_participante_marca_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'desligado'::status_participante
     AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.desligado_registrado_em := COALESCE(NEW.desligado_registrado_em, now());
  END IF;
  IF NEW.status = 'busca_ativa'::status_participante
     AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.busca_ativa_desde := COALESCE(NEW.busca_ativa_desde, now());
  END IF;
  RETURN NEW;
END;
$$;