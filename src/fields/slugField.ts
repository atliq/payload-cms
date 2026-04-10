import type { Field } from 'payload'

const formatSlug = (val: string): string =>
  val
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

export const slugField = (sourceField: string = 'title'): Field => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
  },
  hooks: {
    beforeValidate: [
      ({ value, data, operation }) => {
        if (operation === 'create' && !value && data?.[sourceField]) {
          return formatSlug(data[sourceField])
        }
        if (value) {
          return formatSlug(value)
        }
        return value
      },
    ],
  },
})
