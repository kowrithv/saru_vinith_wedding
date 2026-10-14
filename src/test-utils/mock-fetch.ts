import { vi } from 'vitest'

export interface MockResponse {
  status?: number
  body: unknown
}

/** Antwort fest, per Funktion oder als Folge (der letzte Eintrag wiederholt sich). */
export type MockRoute = MockResponse | ((init?: RequestInit) => MockResponse) | MockResponse[]

/**
 * Ersetzt `fetch` durch einen Mock, der nach dem Pfad (ohne Query) antwortet.
 * Anders als eine feste Antwort-Reihenfolge übersteht das neue Aufrufe wie die
 * Zugangsprüfung: ein unbekannter Pfad wird abgelehnt (Netzwerkfehler).
 */
export function mockFetchRoutes(routes: Record<string, MockRoute>) {
  const counters = new Map<string, number>()
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const path = url.split('?')[0]
    const route = routes[path]
    if (!route) throw new Error(`unerwarteter fetch-Aufruf: ${url}`)

    let response: MockResponse
    if (typeof route === 'function') {
      response = route(init)
    } else if (Array.isArray(route)) {
      const index = Math.min(counters.get(path) ?? 0, route.length - 1)
      counters.set(path, index + 1)
      response = route[index]
    } else {
      response = route
    }
    const { status = 200, body } = response
    return { ok: status < 400, status, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function callsTo(fn: ReturnType<typeof mockFetchRoutes>, path: string) {
  return fn.mock.calls.filter(([input]) => String(input).split('?')[0] === path)
}

export function bodyOf(call: Parameters<typeof fetch>): Record<string, unknown> {
  return JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>
}
