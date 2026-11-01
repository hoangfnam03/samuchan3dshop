export function filamentTypeKey(value: string | null | undefined) {
  return (value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi-VN')
}
