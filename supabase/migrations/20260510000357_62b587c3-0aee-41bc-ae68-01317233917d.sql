UPDATE public.drive_sync_queue
SET status='pendente', drive_file_id=NULL, drive_url=NULL, ultimo_erro=NULL, tentativas=0
WHERE id IN (
  SELECT DISTINCT ON (tipo) id
  FROM public.drive_sync_queue
  WHERE tipo IN ('relatorio','planejamento')
  ORDER BY tipo, updated_at DESC
);