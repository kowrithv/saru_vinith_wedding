// Holt Bilder schon vor dem Gebrauch in den Browser-Cache. Die Objekte werden
// gemerkt, sonst kann der Browser den Abruf verwerfen, bevor er fertig ist; und
// jede Adresse wird nur einmal angefragt (neues Spiel, erneutes Einblenden).
const warmed = new Map<string, HTMLImageElement>()

export function preloadImages(urls: readonly string[]): void {
  if (typeof Image === 'undefined') return
  for (const url of urls) {
    if (warmed.has(url)) continue
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    warmed.set(url, image)
  }
}
