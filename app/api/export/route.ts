import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { connection } from 'next/server'

const MAX_PACK_BYTES = 100 * 1024 * 1024
const PACK_PATH = /^packs\/[A-Za-z0-9_-]{1,96}\/[A-Za-z0-9_-]{1,96}\.zip$/

function reject(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Client upload token exchange for evidence packs. The browser uploads the zip straight to Blob, so the pack never
 * passes through a function body and its 4.5 MB limit.
 */
export async function POST(req: Request): Promise<Response> {
  await connection()
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return reject(503, 'Blob storage is not configured.')

  let body: HandleUploadBody
  try {
    body = (await req.json()) as HandleUploadBody
  } catch {
    return reject(400, 'The body is not JSON.')
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      token,
      onBeforeGenerateToken: async (pathname) => {
        if (!PACK_PATH.test(pathname)) throw new Error('The pack path must be packs/<project>/<run id>.zip.')
        return {
          allowedContentTypes: ['application/zip'],
          maximumSizeInBytes: MAX_PACK_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      },
    })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return reject(400, error instanceof Error ? error.message : 'The upload token was refused.')
  }
}
