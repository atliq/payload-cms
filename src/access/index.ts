import type { Access } from 'payload'

export const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

export const isAuthenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user) return true
  return { status: { equals: 'published' } }
}
