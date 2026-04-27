/**
 * Constroi o searchKey usado em buscas LIKE no Postgres.
 * Concatena tudo em lowercase: nome + iniciais (M J S) + identificadores.
 *
 * Exemplo:
 *   buildClientSearchKey({ name: 'Maria Julia Silva', cpfCnpj: '12345678900', whatsapp: '5537999...' })
 *   → 'maria julia silva mjs 12345678900 5537999...'
 *
 * Busca "mjs" (substring) achara essa entrada porque 'mjs' esta no meio.
 * Busca "maria" tambem achara. Busca "12345" idem.
 */

function initials(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('')
}

export function buildClientSearchKey(c: {
  name: string
  cpfCnpj?: string | null
  whatsapp?: string | null
  phone?: string | null
}): string {
  return [
    c.name.toLowerCase(),
    initials(c.name),
    c.cpfCnpj || '',
    c.whatsapp || '',
    c.phone || '',
  ].filter(Boolean).join(' ').trim()
}

export function buildProductSearchKey(p: { name: string }): string {
  return [p.name.toLowerCase(), initials(p.name)].filter(Boolean).join(' ').trim()
}
