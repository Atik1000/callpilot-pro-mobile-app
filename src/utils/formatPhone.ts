/** Strip everything except digits, + and # * */
export function normalizePhone(input: string): string {
  return input.replace(/[^\d+#*]/g, '');
}

/** "07700900456" -> "07700 900456"; leaves short/other numbers readable */
export function formatPhone(input: string): string {
  const raw = normalizePhone(input);
  if (/^07\d{9}$/.test(raw)) return `${raw.slice(0, 5)} ${raw.slice(5)}`;
  if (/^0\d{9,10}$/.test(raw)) return `${raw.slice(0, 4)} ${raw.slice(4)}`;
  if (/^\+447\d{9}$/.test(raw)) return `+44 ${raw.slice(3, 7)} ${raw.slice(7)}`;
  return raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim() || input;
}

export function isDiallable(input: string): boolean {
  const raw = normalizePhone(input).replace(/[#*]/g, '');
  return raw.replace(/\D/g, '').length >= 3;
}
