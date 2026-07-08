export type PhoneSegments = [string, string, string]

export function isCompletePhoneSegments(s: PhoneSegments): boolean {
  return /^\d{3}$/.test(s[0]) && /^\d{4}$/.test(s[1]) && /^\d{4}$/.test(s[2])
}

export function joinPhoneSegments(s: PhoneSegments): string {
  if (s.every((x) => !x.trim())) return ""
  return `${s[0]}-${s[1]}-${s[2]}`
}

export function parsePhoneToSegments(phone: string): PhoneSegments {
  const digits = phone.replace(/\D/g, "")
  if (digits.length <= 3) return [digits.slice(0, 3), "", ""]
  if (digits.length <= 7) return [digits.slice(0, 3), digits.slice(3, 7), ""]
  return [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)]
}

const SEGMENT_MAX_LEN: [number, number, number] = [3, 4, 4]

export function updatePhoneSegment(
  prev: PhoneSegments,
  index: 0 | 1 | 2,
  value: string,
): PhoneSegments {
  const digits = value.replace(/\D/g, "").slice(0, SEGMENT_MAX_LEN[index])
  const next: PhoneSegments = [...prev] as PhoneSegments
  next[index] = digits
  return next
}
