export function parseStoredFilamentTypes(value: string | null | undefined, legacyValue?: string | null): string[] {
  if (value) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))]
      }
    } catch {
      // Existing rows may still contain the old single-value format.
    }
  }
  return legacyValue?.trim() ? [legacyValue.trim()] : []
}

export function parseFilamentTypesInput(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 80 || result.includes(item.trim())) return undefined
    result.push(item.trim())
  }
  return result
}
