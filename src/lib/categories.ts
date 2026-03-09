export const DOCUMENT_CATEGORIES = [
  'Action List',
  'Permits',
  'Daily Logs',
  'RFIs',
  'Submittals',
  'Safety',
  'Quality',
  'Commissioning',
  'Interconnection',
  'Contracts',
  'Change Orders',
  'Photos',
  'Other',
] as const

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]
