'use client'

import { useForm, useFormFields } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'

type WhereValue = Record<string, unknown> | undefined

const buildRange = (dateFrom?: unknown, dateTo?: unknown): Record<string, unknown> | null => {
  const createdAt: Record<string, string> = {}
  if (typeof dateFrom === 'string' && dateFrom) {
    createdAt.greater_than_equal = dateFrom
  }
  if (typeof dateTo === 'string' && dateTo) {
    // Include the full "to" day: compare against the start of the next day
    const end = new Date(dateTo)
    end.setDate(end.getDate() + 1)
    createdAt.less_than = end.toISOString()
  }
  return Object.keys(createdAt).length ? { createdAt } : null
}

/**
 * Renders nothing: merges the dateFrom/dateTo picker values into the export's
 * hidden `where` field, so preview, download, and save all respect the range.
 */
export const ExportDateRangeSync = (): null => {
  const { dispatchFields } = useForm()
  const dateFrom = useFormFields(([fields]) => fields?.dateFrom?.value)
  const dateTo = useFormFields(([fields]) => fields?.dateTo?.value)
  const where = useFormFields(([fields]) => fields?.where?.value) as WhereValue

  // The where clause the list view provides (e.g. "Current filters") is the base;
  // it can change underneath us when the user switches the selection option.
  const lastInjected = useRef<WhereValue>(undefined)
  const baseWhere = useRef<WhereValue>(where)

  useEffect(() => {
    if (JSON.stringify(where) !== JSON.stringify(lastInjected.current)) {
      baseWhere.current = where
    }
    const range = buildRange(dateFrom, dateTo)
    const base =
      baseWhere.current && Object.keys(baseWhere.current).length ? [baseWhere.current] : []
    const next = range ? { and: [...base, range] } : (baseWhere.current ?? {})
    if (JSON.stringify(next) !== JSON.stringify(where ?? {})) {
      lastInjected.current = next
      dispatchFields({ type: 'UPDATE', path: 'where', value: next })
    }
  }, [dateFrom, dateTo, where, dispatchFields])

  return null
}
