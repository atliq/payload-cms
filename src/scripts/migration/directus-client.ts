const DIRECTUS_URL = 'https://wp-api.atliq.com'
const DIRECTUS_TOKEN = 'tWJb85pfj61CxOsCrrpBpiWwe54CyucB'

async function directusFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Directus API error ${res.status}: ${res.statusText} for ${path}`)
  }
  const json = (await res.json()) as { data: T }
  return json.data
}

export async function fetchAuthors() {
  return directusFetch<any[]>('/items/Author?fields=*,seo.SEO_id.*&limit=-1')
}

export async function fetchCategories() {
  return directusFetch<any[]>('/items/Categories?fields=*&limit=-1')
}

export async function fetchPosts() {
  return directusFetch<any[]>(
    '/items/Posts?fields=*,categories.Categories_id.*,seo.SEO_id.*,author.*&limit=-1',
  )
}

export async function fetchCulturePosts() {
  return directusFetch<any[]>(
    '/items/CulturePosts?fields=*,categories.Categories_id.*,seo.SEO_id.*&limit=-1',
  )
}

export async function fetchInquiries() {
  return directusFetch<any[]>('/items/Inquiries?fields=*&limit=-1')
}

export async function fetchSeoRecords() {
  return directusFetch<any[]>('/items/SEO?fields=*&limit=-1')
}

export async function downloadAsset(uuid: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const res = await fetch(`${DIRECTUS_URL}/assets/${uuid}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  })
  if (!res.ok) {
    throw new Error(`Failed to download asset ${uuid}: ${res.status}`)
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const disposition = res.headers.get('content-disposition') || ''
  let filename = uuid
  const match = disposition.match(/filename[*]?=(?:UTF-8''|"?)([^";]+)/)
  if (match) {
    filename = decodeURIComponent(match[1].replace(/"/g, ''))
  }

  const arrayBuffer = await res.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    filename,
    contentType,
  }
}

export async function fetchFileInfo(uuid: string): Promise<any> {
  const res = await fetch(`${DIRECTUS_URL}/files/${uuid}`, {
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data: any }
  return json.data
}
