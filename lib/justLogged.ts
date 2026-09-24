// Remembers which category was just logged so the dashboard can show a "$X left" message once.
let pendingCategoryId: string | null = null

export function setJustLogged(categoryId: string | null) {
  pendingCategoryId = categoryId
}

export function takeJustLogged(): string | null {
  const id = pendingCategoryId
  pendingCategoryId = null
  return id
}