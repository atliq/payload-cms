import { NextResponse, type NextRequest } from 'next/server'

// ponytail: media filenames are stable (Payload regenerates the filename on
// re-upload), so edge-cache aggressively. Cloudflare caches these by
// extension + Cache-Control, and 1yr/immutable matches the asset lifetime.
export function middleware(_request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return response
}

export const config = {
  matcher: '/api/media/file/:path*',
}
