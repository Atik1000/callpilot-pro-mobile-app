/**
 * "J. Smith" -> "JS", "A. Brown" -> "AB", "07700 900123" -> "#"
 */
export function getInitials(name: string): string {
  const cleaned = name.replace(/[–—-].*$/, '').trim();
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ''))
    .filter(Boolean);

  if (words.length === 0) return '#';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
