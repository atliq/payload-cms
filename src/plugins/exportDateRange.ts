import type { CollectionConfig, Field } from 'payload'

// Virtual fields: shown in the export drawer but never stored, so they add no DB columns
const dateRangeFields: Field[] = [
  {
    type: 'row',
    fields: [
      {
        name: 'dateFrom',
        type: 'date',
        label: 'Created from',
        virtual: true,
        admin: {
          date: { pickerAppearance: 'dayOnly' },
          description: 'Only include entries created on or after this date',
          width: '50%',
        },
      },
      {
        name: 'dateTo',
        type: 'date',
        label: 'Created to',
        virtual: true,
        admin: {
          date: { pickerAppearance: 'dayOnly' },
          description: 'Only include entries created on or before this date',
          width: '50%',
        },
      },
    ],
  },
  {
    name: 'dateRangeSync',
    type: 'ui',
    admin: {
      components: {
        Field: '/components/ExportDateRangeSync#ExportDateRangeSync',
      },
    },
  },
]

/**
 * overrideCollection for the import-export plugin's exports collection:
 * adds a created-date range to the export drawer, inserted right after the
 * "Selection to use" option inside the Export Options collapsible.
 */
export const withExportDateRange = ({
  collection,
}: {
  collection: CollectionConfig
}): CollectionConfig => ({
  ...collection,
  fields: collection.fields.map((field): Field => {
    if (
      'fields' in field &&
      Array.isArray(field.fields) &&
      field.fields.some((f) => 'name' in f && f.name === 'selectionToUse')
    ) {
      const idx = field.fields.findIndex((f) => 'name' in f && f.name === 'selectionToUse')
      const fields = [...field.fields]
      fields.splice(idx + 1, 0, ...dateRangeFields)
      return { ...field, fields } as Field
    }
    return field
  }),
})
