import type { CollectionConfig } from 'payload'
import { isAuthenticated } from '@/access'

export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  labels: {
    singular: 'Inquiry',
    plural: 'Inquiries',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'company', 'subject', 'status', 'createdAt'],
    group: 'Forms',
  },
  access: {
    read: isAuthenticated,
    create: () => true,
    update: isAuthenticated,
    delete: isAuthenticated,
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'email',
          type: 'email',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'phone',
          type: 'text',
          admin: { width: '50%' },
        },
        {
          name: 'company',
          type: 'text',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'website',
      type: 'text',
    },
    {
      name: 'subject',
      type: 'text',
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
    },
    {
      name: 'sourceIp',
      type: 'text',
      label: 'Source IP',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
