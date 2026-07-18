import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'

import { itinerary } from '#/db/schema'
import { closeTestDb, createTestUser, resetTestDb, setupTestDb, testDb } from '#/test/db'
import { createItineraryImpl } from './itineraries'
import {
  ERR_BLOB_STORAGE_NOT_CONFIGURED,
  resolveUploadPath,
  selectStorage,
  uploadCoverImpl,
} from './uploads'

// `vercelBlobStorage` (invoked by `selectStorage` when a token is present)
// dynamically imports `@vercel/blob`; mocking the module here intercepts
// that dynamic import too, so these tests never touch the real Vercel Blob
// API — see the "storage selection" describe block below.
const putMock = vi.hoisted(() => vi.fn())
vi.mock('@vercel/blob', () => ({ put: putMock }))

// A minimal valid 1x1 PNG (89 50 4E 47 0D 0A 1A 0A signature + IHDR/IDAT/IEND chunks).
const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
)

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])

const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // size (unused by the sniffer)
  0x57, 0x45, 0x42, 0x50, // WEBP
])

const TEXT_BYTES = new TextEncoder().encode('this is definitely not an image, just plain text')

describe('uploads server functions', () => {
  let uploadsDir: string

  beforeAll(async () => {
    await setupTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
    uploadsDir = await mkdtemp(path.join(tmpdir(), 'uploads-test-'))
  })

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true })
  })

  afterAll(async () => {
    await resetTestDb()
    await closeTestDb()
  })

  describe('uploadCoverImpl', () => {
    it('rejects an anonymous caller', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      await expect(
        uploadCoverImpl(
          testDb,
          null,
          {
            itineraryId: created.id,
            bytes: PNG_BYTES,
            originalName: 'cover.png',
            declaredMime: 'image/png',
            uploadsDir,
          },
        ),
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('rejects a non-author', async () => {
      const author = await createTestUser()
      const other = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      await expect(
        uploadCoverImpl(
          testDb,
          { user: { id: other.id } },
          {
            itineraryId: created.id,
            bytes: PNG_BYTES,
            originalName: 'cover.png',
            declaredMime: 'image/png',
            uploadsDir,
          },
        ),
      ).rejects.toThrow('FORBIDDEN')
    })

    it('rejects an oversized file', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      const oversized = new Uint8Array(4 * 1024 * 1024 + 1)
      oversized.set(PNG_BYTES) // valid PNG signature, only size should trip the check

      await expect(
        uploadCoverImpl(
          testDb,
          { user: { id: author.id } },
          {
            itineraryId: created.id,
            bytes: oversized,
            originalName: 'cover.png',
            declaredMime: 'image/png',
            uploadsDir,
          },
        ),
      ).rejects.toThrow()

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.coverImageUrl).toBeNull()
    })

    it('rejects a spoofed type (declared image/png, bytes are plain text)', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      await expect(
        uploadCoverImpl(
          testDb,
          { user: { id: author.id } },
          {
            itineraryId: created.id,
            bytes: TEXT_BYTES,
            originalName: 'cover.png',
            declaredMime: 'image/png',
            uploadsDir,
          },
        ),
      ).rejects.toThrow()

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.coverImageUrl).toBeNull()
    })

    it('stores a valid png, updates coverImageUrl, and writes the file to disk', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      const result = await uploadCoverImpl(
        testDb,
        { user: { id: author.id } },
        {
          itineraryId: created.id,
          bytes: PNG_BYTES,
          originalName: 'whatever-the-user-called-it.txt',
          declaredMime: 'application/octet-stream',
          uploadsDir,
        },
      )

      expect(result.url).toMatch(/^\/api\/uploads\/[\w-]+\.png$/)

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.coverImageUrl).toBe(result.url)

      const filename = result.url.replace('/api/uploads/', '')
      const onDisk = await readFile(path.join(uploadsDir, filename))
      expect(new Uint8Array(onDisk)).toEqual(PNG_BYTES)
    })

    it('stores a valid jpeg with a .jpg extension derived from sniffed bytes, not the original name', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      const result = await uploadCoverImpl(
        testDb,
        { user: { id: author.id } },
        {
          itineraryId: created.id,
          bytes: JPEG_BYTES,
          originalName: 'photo.png', // lies about its own type
          declaredMime: 'image/png', // lies too
          uploadsDir,
        },
      )

      expect(result.url).toMatch(/\.jpg$/)
    })

    it('stores a valid webp', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      const result = await uploadCoverImpl(
        testDb,
        { user: { id: author.id } },
        {
          itineraryId: created.id,
          bytes: WEBP_BYTES,
          originalName: 'cover.webp',
          declaredMime: 'image/webp',
          uploadsDir,
        },
      )

      expect(result.url).toMatch(/\.webp$/)
    })

    it('replacing an existing cover overwrites coverImageUrl', async () => {
      const author = await createTestUser()
      const created = await createItineraryImpl(testDb, { user: { id: author.id } }, {
        title: 'Weekend in Lisbon',
        destination: 'Lisbon',
      })

      const first = await uploadCoverImpl(
        testDb,
        { user: { id: author.id } },
        {
          itineraryId: created.id,
          bytes: PNG_BYTES,
          originalName: 'cover.png',
          declaredMime: 'image/png',
          uploadsDir,
        },
      )
      const second = await uploadCoverImpl(
        testDb,
        { user: { id: author.id } },
        {
          itineraryId: created.id,
          bytes: JPEG_BYTES,
          originalName: 'cover2.jpg',
          declaredMime: 'image/jpeg',
          uploadsDir,
        },
      )

      expect(second.url).not.toBe(first.url)

      const row = await testDb.query.itinerary.findFirst({ where: eq(itinerary.id, created.id) })
      expect(row?.coverImageUrl).toBe(second.url)
    })
  })

  describe('resolveUploadPath', () => {
    it('resolves a plain filename inside the uploads dir', () => {
      const resolved = resolveUploadPath({ uploadsDir: '/data/uploads', requested: 'abc123.png' })
      expect(resolved).toBe(path.resolve('/data/uploads', 'abc123.png'))
    })

    it('returns null for a traversal attempt that escapes the uploads dir', () => {
      expect(resolveUploadPath({ uploadsDir: '/data/uploads', requested: '../../etc/passwd' })).toBeNull()
      expect(resolveUploadPath({ uploadsDir: '/data/uploads', requested: '../secret.txt' })).toBeNull()
    })

    it('returns null for an absolute path outside the uploads dir', () => {
      expect(resolveUploadPath({ uploadsDir: '/data/uploads', requested: '/etc/passwd' })).toBeNull()
    })

    it('returns null when the requested path resolves to the uploads dir itself', () => {
      expect(resolveUploadPath({ uploadsDir: '/data/uploads', requested: '.' })).toBeNull()
      expect(resolveUploadPath({ uploadsDir: '/data/uploads', requested: '' })).toBeNull()
    })
  })
})

describe('selectStorage', () => {
  afterEach(() => {
    putMock.mockReset()
  })

  it('writes to disk when no blobReadWriteToken is given and not on Vercel', async () => {
    const uploadsDir = await mkdtemp(path.join(tmpdir(), 'select-storage-test-'))
    try {
      const storage = selectStorage({ uploadsDir, blobReadWriteToken: undefined, isVercel: false })
      const url = await storage.put({ filename: 'cover.png', bytes: PNG_BYTES, contentType: 'image/png' })

      expect(url).toBe('/api/uploads/cover.png')
      expect(putMock).not.toHaveBeenCalled()

      const onDisk = await readFile(path.join(uploadsDir, 'cover.png'))
      expect(new Uint8Array(onDisk)).toEqual(PNG_BYTES)
    } finally {
      await rm(uploadsDir, { recursive: true, force: true })
    }
  })

  it('uploads to Vercel Blob when a blobReadWriteToken is given, without touching disk', async () => {
    putMock.mockResolvedValue({ url: 'https://example.public.blob.vercel-storage.com/cover.png' })

    // Deliberately pointed at a directory that doesn't exist: proves the
    // blob path never falls back to (or touches) the filesystem.
    const storage = selectStorage({
      uploadsDir: '/nonexistent/uploads-dir',
      blobReadWriteToken: 'test-token',
      isVercel: true,
    })
    const url = await storage.put({ filename: 'cover.png', bytes: PNG_BYTES, contentType: 'image/png' })

    expect(url).toBe('https://example.public.blob.vercel-storage.com/cover.png')
    expect(putMock).toHaveBeenCalledTimes(1)
    expect(putMock).toHaveBeenCalledWith(
      'cover.png',
      expect.anything(),
      expect.objectContaining({ access: 'public', addRandomSuffix: false, contentType: 'image/png' }),
    )
  })

  it('throws ERR_BLOB_STORAGE_NOT_CONFIGURED on Vercel with no blobReadWriteToken, instead of falling back to disk', () => {
    expect(() =>
      selectStorage({ uploadsDir: '/nonexistent/uploads-dir', blobReadWriteToken: undefined, isVercel: true }),
    ).toThrow(ERR_BLOB_STORAGE_NOT_CONFIGURED)
    expect(putMock).not.toHaveBeenCalled()
  })
})
