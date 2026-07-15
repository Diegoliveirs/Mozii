-- v2: editar review próprio

create policy "posts: atualizo os meus" on posts
  for update using (author_id = auth.uid());
