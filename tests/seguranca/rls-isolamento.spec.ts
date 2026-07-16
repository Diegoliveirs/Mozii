import { test, expect } from '@playwright/test'
import { api, signInOrUp } from '../helpers/api'
import { resetTestUser } from '../helpers/reset'

/**
 * Prova que a RLS do Supabase isola casais: um usuário de outro casal (C)
 * não lê nem escreve os dados do casal 1 (A + B). Bate direto na REST API,
 * sem UI. Reaproveita os 2 usuários E2E fixos + um terceiro para o casal 2.
 */

const userA = { name: 'Ana Teste', email: 'mozii.e2e.a@gmail.com', password: 'senha-teste-123' }
const userB = { name: 'Diego Teste', email: 'mozii.e2e.b@gmail.com', password: 'senha-teste-123' }
const userC = { name: 'Intruso Teste', email: 'mozii.e2e.c@gmail.com', password: 'senha-teste-123' }

// objeto plano de propósito: o helper api() espalha init.headers com spread,
// e espalhar um Headers dá {} (props não enumeráveis) — o Prefer se perderia.
const json = { Prefer: 'return=representation' }

async function rows(res: Response): Promise<unknown[]> {
  const body = await res.json().catch(() => null)
  return Array.isArray(body) ? body : []
}

// contexto montado no beforeAll e consumido pelos testes
let couple1Id: string
let aId: string
let bToken: string
let cToken: string
let postId: string
let listId: string
let commentId: string
let reactionId: string

test.beforeAll(async () => {
  // 1. zera os três usuários — todos fora de qualquer casal
  await resetTestUser(userA.email, userA.password, userA.name)
  await resetTestUser(userB.email, userB.password, userB.name)
  await resetTestUser(userC.email, userC.password, userC.name)

  const a = await signInOrUp(userA.email, userA.password, userA.name)
  const b = await signInOrUp(userB.email, userB.password, userB.name)
  const c = await signInOrUp(userC.email, userC.password, userC.name)
  aId = a.userId
  bToken = b.token
  cToken = c.token

  // 2. A cria o casal 1, B entra; C cria o casal 2 (fica sozinho)
  const coupleRes = await api('/rest/v1/rpc/create_couple', a.token, { method: 'POST', body: '{}' })
  const couple1 = await coupleRes.json()
  couple1Id = couple1.id
  await api('/rest/v1/rpc/join_couple', b.token, {
    method: 'POST',
    body: JSON.stringify({ code: couple1.invite_code }),
  })
  await api('/rest/v1/rpc/create_couple', c.token, { method: 'POST', body: '{}' })

  // 3. semeia conteúdo do casal 1 (como A)
  const [post] = await rows(
    await api('/rest/v1/posts', a.token, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ couple_id: couple1Id, author_id: aId, type: 'post', body: 'segredo do casal 1' }),
    }),
  )
  postId = (post as { id: string }).id

  await api('/rest/v1/movies', a.token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ tmdb_id: 550, title: 'Fight Club' }),
  })
  const [list] = await rows(
    await api('/rest/v1/lists', a.token, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ couple_id: couple1Id, name: 'Lista secreta', created_by: aId }),
    }),
  )
  listId = (list as { id: string }).id
  await api('/rest/v1/list_items', a.token, {
    method: 'POST',
    body: JSON.stringify({ list_id: listId, tmdb_id: 550, added_by: aId }),
  })

  const [comment] = await rows(
    await api('/rest/v1/comments', a.token, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ post_id: postId, author_id: aId, body: 'comentário privado' }),
    }),
  )
  commentId = (comment as { id: string }).id
  const [reaction] = await rows(
    await api('/rest/v1/reactions', a.token, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ post_id: postId, author_id: aId, emoji: '❤️' }),
    }),
  )
  reactionId = (reaction as { id: string }).id

  // sanidade do setup: tudo foi criado
  expect(postId, 'post do casal 1 criado').toBeTruthy()
  expect(listId, 'lista do casal 1 criada').toBeTruthy()
  expect(commentId, 'comentário criado').toBeTruthy()
  expect(reactionId, 'reação criada').toBeTruthy()
})

test('C (outro casal) NÃO lê nem apaga os posts do casal 1', async () => {
  expect(await rows(await api(`/rest/v1/posts?couple_id=eq.${couple1Id}`, cToken))).toHaveLength(0)
  expect(await rows(await api(`/rest/v1/posts?id=eq.${postId}`, cToken))).toHaveLength(0)

  // delete não atinge nenhuma linha (RLS filtra antes)
  const del = await api(`/rest/v1/posts?id=eq.${postId}`, cToken, { method: 'DELETE', headers: json })
  expect(await rows(del)).toHaveLength(0)
  // e o post continua existindo para o dono
  expect(await rows(await api(`/rest/v1/posts?id=eq.${postId}`, bToken))).toHaveLength(1)
})

test('C NÃO lê nem apaga listas e itens do casal 1', async () => {
  expect(await rows(await api(`/rest/v1/lists?couple_id=eq.${couple1Id}`, cToken))).toHaveLength(0)
  expect(await rows(await api(`/rest/v1/list_items?list_id=eq.${listId}`, cToken))).toHaveLength(0)

  const del = await api(`/rest/v1/lists?id=eq.${listId}`, cToken, { method: 'DELETE', headers: json })
  expect(await rows(del)).toHaveLength(0)
})

test('C NÃO lê nem comenta/reage nos posts do casal 1', async () => {
  expect(await rows(await api(`/rest/v1/comments?post_id=eq.${postId}`, cToken))).toHaveLength(0)
  expect(await rows(await api(`/rest/v1/reactions?post_id=eq.${postId}`, cToken))).toHaveLength(0)

  // insert de comentário em post de outro casal é barrado pela WITH CHECK
  const insComment = await api('/rest/v1/comments', cToken, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ post_id: postId, author_id: aId, body: 'invasão' }),
  })
  expect(insComment.status, 'comentário de intruso deve ser rejeitado').toBeGreaterThanOrEqual(400)
  // e nada foi persistido
  expect(await rows(await api(`/rest/v1/comments?id=eq.${commentId}`, bToken))).toHaveLength(1)
  expect(await rows(await api(`/rest/v1/comments?post_id=eq.${postId}`, bToken))).toHaveLength(1)
})

test('C NÃO lê o perfil de A nem a linha do casal 1', async () => {
  expect(await rows(await api(`/rest/v1/profiles?id=eq.${aId}`, cToken))).toHaveLength(0)
  expect(await rows(await api(`/rest/v1/couples?id=eq.${couple1Id}`, cToken))).toHaveLength(0)
})

test('sanidade: B (mesmo casal) LÊ todo o conteúdo do casal 1', async () => {
  expect(await rows(await api(`/rest/v1/posts?id=eq.${postId}`, bToken))).toHaveLength(1)
  expect(await rows(await api(`/rest/v1/lists?id=eq.${listId}`, bToken))).toHaveLength(1)
  expect(await rows(await api(`/rest/v1/list_items?list_id=eq.${listId}`, bToken))).toHaveLength(1)
  expect(await rows(await api(`/rest/v1/reactions?id=eq.${reactionId}`, bToken))).toHaveLength(1)
  expect(await rows(await api(`/rest/v1/profiles?id=eq.${aId}`, bToken))).toHaveLength(1)
  expect(await rows(await api(`/rest/v1/couples?id=eq.${couple1Id}`, bToken))).toHaveLength(1)
})

test('comportamento conhecido: cache movies é compartilhado entre todos os autenticados', async () => {
  // DOCUMENTADO, não é falha: qualquer autenticado (inclusive C, de outro casal)
  // lê o cache público de filmes do TMDB. Impacto baixo — dados não sensíveis.
  const visto = await rows(await api('/rest/v1/movies?tmdb_id=eq.550', cToken))
  expect(visto, 'movies é cache público por design (ver 002_lists.sql)').toHaveLength(1)
})

test.afterAll(async () => {
  // devolve os usuários ao estado limpo (sem casal, sem conteúdo)
  await resetTestUser(userA.email, userA.password, userA.name)
  await resetTestUser(userB.email, userB.password, userB.name)
  await resetTestUser(userC.email, userC.password, userC.name)
})
