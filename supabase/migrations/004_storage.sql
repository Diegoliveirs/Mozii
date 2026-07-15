-- Fase 3: bucket privado de fotos, path {couple_id}/{uuid}.jpg

insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', false);

create policy "fotos: leio do meu casal" on storage.objects
  for select using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = my_couple_id()::text
  );

create policy "fotos: envio para meu casal" on storage.objects
  for insert with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = my_couple_id()::text
  );

create policy "fotos: excluo do meu casal" on storage.objects
  for delete using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = my_couple_id()::text
  );
