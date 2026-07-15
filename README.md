# Mozii — filmes a dois

Webapp privado para um casal: wishlists de filmes, feed com posts e reviews, reações, e card de compartilhamento para Instagram Stories.

Stack: Vite + React + TypeScript · Tailwind CSS v4 · Supabase · TMDB · React Query.

## Setup (uma vez)

### 1. Supabase

1. Crie um projeto grátis em [supabase.com](https://supabase.com).
2. No painel, abra **SQL Editor** e execute, na ordem, os arquivos de `supabase/migrations/`:
   - `001_profiles_couples.sql`
   - `002_lists.sql`
   - `003_feed.sql`
   - `004_storage.sql`
3. Em **Authentication → Providers → Email**, desative "Confirm email" (ou configure SMTP) para o cadastro funcionar direto.
4. Copie **Settings → API**: `Project URL` e `anon public key`.

### 2. TMDB

1. Crie conta grátis em [themoviedb.org](https://www.themoviedb.org).
2. Em **Configurações → API**, gere uma chave v3.

### 3. Variáveis de ambiente

Edite `.env.local` (valores atuais são placeholders):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_TMDB_API_KEY=sua-chave-tmdb
```

### 4. Rodar

```
npm install
npm run dev
```

## Deploy (Vercel)

1. Suba o repositório no GitHub e importe na [Vercel](https://vercel.com) (free).
2. Configure as 3 variáveis de ambiente no painel da Vercel.
3. `vercel.json` já cuida do rewrite de SPA.

## Fluxo do casal

1. Cada um cria sua conta em `/cadastro`.
2. Um cria o espaço em `/parear` e recebe um código de 6 letras.
3. O outro entra com o código. Pronto — feed, listas e reviews são compartilhados só entre os dois.

## Arquitetura

- `src/data/repositories.ts` — interfaces da camada de dados (contrato).
- `src/data/supabase/` — implementação atual. **Nenhum import de Supabase fora desta pasta.**
- Migração futura para Firebase: implementar as mesmas 5 interfaces em `src/data/firebase/` e trocar a factory em `src/main.tsx`.
- `src/api/tmdb.ts` — busca de filmes (fora da abstração; igual nos dois backends).
- Atividade do feed ("X adicionou Y à lista Z") é gerada no client, não em trigger de banco — porta 1:1 para Firebase.
