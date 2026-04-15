import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoField } from '@/fields/seo'
import { slugField } from '@/fields/slugField'
import { isAuthenticatedOrPublished, isAuthenticated } from '@/access'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'updatedAt'],
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
      name: 'name',
      type: 'text',
      required: true,
    },
    slugField('name'),
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
      name: 'profile',
      type: 'upload',
      relationTo: 'media',
      label: 'Profile Image',
    },
    {
      name: 'linkedinUrl',
      type: 'text',
      label: 'LinkedIn URL',
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Description',
      editor: lexicalEditor(),
    },
    {
      name: 'legacyDescription',
      type: 'textarea',
      label: 'Legacy Description (HTML)',
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data?.legacyDescription),
        description: 'Original HTML from Directus migration.',
      },
    },
    seoField,
  ],
}
