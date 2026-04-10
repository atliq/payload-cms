import type { GroupField } from 'payload'

export const seoField: GroupField = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  admin: {
    description: 'Search engine optimization settings',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Meta Title',
      maxLength: 70,
      admin: {
        description: 'Recommended max 70 characters.',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Meta Description',
      maxLength: 160,
      admin: {
        description: 'Recommended max 160 characters.',
      },
    },
    {
      name: 'canonicalUrl',
      type: 'text',
      label: 'Canonical URL',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'noIndex',
          type: 'checkbox',
          label: 'No Index',
          defaultValue: false,
          admin: {
            description: 'Prevent search engines from indexing.',
            width: '50%',
          },
        },
        {
          name: 'noFollow',
          type: 'checkbox',
          label: 'No Follow',
          defaultValue: false,
          admin: {
            description: 'Prevent search engines from following links.',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'ogImage',
      type: 'upload',
      relationTo: 'media',
      label: 'OG Image',
      admin: {
        description: 'Recommended size: 1200 x 630 pixels.',
      },
    },
    {
      name: 'sitemapChangeFrequency',
      type: 'select',
      label: 'Sitemap Change Frequency',
      options: [
        { label: 'Always', value: 'always' },
        { label: 'Hourly', value: 'hourly' },
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
        { label: 'Never', value: 'never' },
      ],
    },
    {
      name: 'sitemapPriority',
      type: 'number',
      label: 'Sitemap Priority',
      min: 0,
      max: 1,
      admin: {
        step: 0.1,
        description: 'Value between 0.0 and 1.0.',
      },
    },
  ],
}
