// Next ruft register() je Laufzeit (Node und Edge) auf. Die Prüfung der
// Pflicht-Variablen beendet den Prozess mit process.exit(), das es in der
// Edge-Runtime nicht gibt - der Code liegt deshalb in einer eigenen Datei, die
// nur bei NEXT_RUNTIME === 'nodejs' geladen wird (Next-Doku: "Specifying the
// runtime"). Dieser Server läuft immer als Node-Prozess (Docker).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { registerNode } = await import('./instrumentation-node')
  registerNode()
}
