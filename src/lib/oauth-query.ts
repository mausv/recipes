export function signedOAuthQuery(search: string) {
  const params = new URLSearchParams(search)
  return params.has('sig') ? params.toString() : undefined
}

export function toQueryString(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    for (const v of [value ?? []].flat()) query.append(key, v)
  }
  return query.toString()
}
