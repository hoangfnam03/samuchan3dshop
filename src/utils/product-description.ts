export interface ProductDescriptionSections {
  introduction: string
  details: string
}

const detailsHeading = /THÔNG TIN SẢN PHẨM\s*:?[ \t]*/i

export function splitProductDescription(value: string): ProductDescriptionSections {
  const match = detailsHeading.exec(value)
  if (!match || match.index === undefined) return { introduction: value.trim(), details: '' }
  return {
    introduction: value.slice(0, match.index).trim(),
    details: value.slice(match.index + match[0].length).trim(),
  }
}

export function joinProductDescription(introduction: string, details: string): string {
  const story = introduction.trim()
  const information = details.trim()
  return [story, information ? `THÔNG TIN SẢN PHẨM\n\n${information}` : ''].filter(Boolean).join('\n\n')
}
