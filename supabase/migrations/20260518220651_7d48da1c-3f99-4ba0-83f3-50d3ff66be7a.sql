UPDATE public.registros_fotograficos
SET arquivo_url = 'https://lh3.googleusercontent.com/d/' || drive_file_id || '=w1600'
WHERE drive_file_id IS NOT NULL
  AND (arquivo_url LIKE 'https://drive.google.com/uc%' OR arquivo_url IS NULL);

UPDATE public.feed_fotos ff
SET foto_url = 'https://lh3.googleusercontent.com/d/' || rf.drive_file_id || '=w1600'
FROM public.registros_fotograficos rf
WHERE rf.feed_post_id = ff.feed_post_id
  AND rf.drive_file_id IS NOT NULL
  AND ff.foto_url LIKE 'https://drive.google.com/uc%';