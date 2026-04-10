import type { CollectionConfig } from 'payload'
import { seoField } from '@/fields/seo'
import { slugField } from '@/fields/slugField'
import { isAuthenticatedOrPublished, isAuthenticated } from '@/access'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'status', 'publishedAt', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: isAuthenticatedOrPublished,
    create: isAuthenticated,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    slugField('title'),
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Draft', value: 'draft' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Published Date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        position: 'sidebar',
      },
    },
    {
      name: 'content',
      type: 'richText',
    },
    {
      name: 'legacyContent',
      type: 'textarea',
      label: 'Legacy Content (HTML)',
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data?.legacyContent),
        description: 'Original HTML from Directus migration.',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Excerpt',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
    },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    seoField,
  ],
}
