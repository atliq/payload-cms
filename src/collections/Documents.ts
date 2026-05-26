import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isAuthenticated } from '@/access'

// 50 MB cap — Cloudflare Workers reject request bodies over 100 MB; this leaves headroom for multipart overhead.
const MAX_PDF_BYTES = 52_428_800

export const Documents: CollectionConfig = {
  slug: 'documents',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'filename', 'updatedAt'],
    group: 'Media',
  },
  access: {
    read: () => true,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        const file = req.file
        if (file && typeof file.size === 'number' && file.size > MAX_PDF_BYTES) {
          throw new APIError(
            `PDF must be 50 MB or smaller. Uploaded file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
            400,
          )
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable label shown in relationship pickers.',
      },
    },
  ],
  upload: {
    mimeTypes: ['application/pdf'],
    crop: false,
    focalPoint: false,
  },
}
