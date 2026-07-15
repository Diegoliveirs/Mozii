import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePost } from '../hooks/useFeed'
import { resizePhoto } from '../lib/image'
import { t } from '../lib/i18n'

export function NewPostPage() {
  const navigate = useNavigate()
  const createPost = useCreatePost()
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const resized = photo ? await resizePhoto(photo) : undefined
      await createPost.mutateAsync({ body: body.trim(), photo: resized })
      navigate('/')
    } catch {
      setError(t.common.error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-6">
      <h1 className="mb-4 text-lg font-medium text-snow">Novo post</h1>
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t.feed.newPost}
        rows={5}
        className="w-full rounded-2xl border border-line-strong bg-card px-4 py-3 text-sm text-snow placeholder-ash outline-none focus:border-rose"
      />

      {preview && (
        <div className="relative mt-3">
          <img src={preview} alt="" className="max-h-72 w-full rounded-2xl object-cover" />
          <button
            type="button"
            onClick={() => {
              setPhoto(null)
              setPreview(null)
              if (fileInput.current) fileInput.current.value = ''
            }}
            aria-label="Remover foto"
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          >
            ×
          </button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={handlePhoto}
        className="hidden"
        id="photo-input"
      />
      {!preview && (
        <label
          htmlFor="photo-input"
          className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong py-4 text-sm text-ash"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zM3 16l5-5c.9-.9 2.1-.9 3 0l5 5M14 14l1-1c.9-.9 2.1-.9 3 0l3 3" />
          </svg>
          Adicionar foto
        </label>
      )}

      {error && <p className="mt-2 text-sm text-rose-soft">{error}</p>}

      <button
        type="submit"
        disabled={(!body.trim() && !photo) || createPost.isPending}
        className="mt-4 w-full rounded-xl bg-rose py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        {createPost.isPending ? t.common.loading : t.feed.publish}
      </button>
    </form>
  )
}
