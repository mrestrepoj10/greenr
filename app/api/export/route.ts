import { connection } from 'next/server'
import { put } from '@vercel/blob'

const MAX_PACK_BYTES = 25 * 1024 * 1024
const SAFE_ID = /^[A-Za-z0-9_-]{1,96}$/
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

function reject(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function readZip(req: Request): Promise<Blob | null> {
  const type = req.headers.get('content-type') ?? ''
  if (type.startsWith('multipart/form-data')) {
    const file = (await req.formData()).get('file')
    return file instanceof Blob ? file : null
  }
  return req.blob()
}

async function isZip(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, ZIP_MAGIC.length).arrayBuffer())
  return ZIP_MAGIC.every((b, i) => head[i] === b)
}

export async function POST(req: Request): Promise<Response> {
  await connection()
  const runId = req.headers.get('x-run-id') ?? ''
  const project = req.headers.get('x-project') ?? ''
  if (!SAFE_ID.test(runId) || !SAFE_ID.test(project)) {
    return reject(400, 'x-run-id and x-project headers are required and may only contain letters, digits, _ and -.')
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_PACK_BYTES) return reject(413, 'The pack exceeds 25 MB.')

  const file = await readZip(req)
  if (!file || file.size === 0) return reject(400, 'Send the zip as the raw body or as a multipart field named file.')
  if (file.size > MAX_PACK_BYTES) return reject(413, 'The pack exceeds 25 MB.')
  if (!(await isZip(file))) return reject(400, 'The body is not a zip file.')

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return reject(503, 'Blob storage is not configured.')

  try {
    const blob = await put(`packs/${project}/${runId}.zip`, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/zip',
      token,
    })
    return Response.json({ url: blob.url, size: file.size }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Evidence pack upload failed', error)
    return reject(502, 'The upload to Blob storage failed.')
  }
}
