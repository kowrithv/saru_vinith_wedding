// Übernimmt die Stimmen der "Wer von uns?"-Abstimmung der alten Seite
// (data/who-votes.json) in die neue Seite. Fragen-IDs, Texte und Antworten
// sind in beiden gleich. Namen der Abstimmenden werden bewusst nicht übernommen:
// die neue Seite speichert keine.

function tallyTotal(questions) {
  let total = 0
  for (const state of Object.values(questions ?? {})) {
    for (const count of Object.values(state?.tally ?? {})) {
      if (Number.isFinite(count)) total += count
    }
  }
  return total
}

/**
 * @param {unknown} data Inhalt der alten who-votes.json
 * @returns {{ votes: { questionId: string, option: string, voterId: string }[], problems: string[] }}
 */
export function parseOldVotes(data) {
  const problems = []
  const list = data && Array.isArray(data.votes) ? data.votes : null
  if (!list) {
    problems.push('Die Datei enthält keine Liste "votes" - es gibt nichts zu übernehmen.')
    return { votes: [], problems }
  }

  const votes = []
  list.forEach((entry, index) => {
    const valid =
      entry &&
      typeof entry === 'object' &&
      typeof entry.questionId === 'string' &&
      entry.questionId.length > 0 &&
      typeof entry.option === 'string' &&
      entry.option.length > 0
    if (!valid) {
      problems.push(`Eintrag ${index + 1} ist unbrauchbar und wird übersprungen.`)
      return
    }
    // Stabile Kennung: ein zweiter Lauf trifft dieselbe voterId und legt nichts doppelt an.
    const suffix = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : String(index)
    votes.push({ questionId: entry.questionId, option: entry.option, voterId: `legacy-${suffix}` })
  })

  const counted = tallyTotal(data.questions)
  if (counted !== list.length) {
    problems.push(
      `Die Zähler der Fragen ergeben ${counted} Stimmen, die Stimmenliste hat ${list.length} Einträge. ` +
        'Übernommen wird nur die Liste.'
    )
  }
  return { votes, problems }
}

/**
 * Schickt die Stimmen an die Abstimm-Route der neuen Seite.
 * @param {{ baseUrl: string, votes: { questionId: string, option: string, voterId: string }[], apply: boolean, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{ vote: object, status: 'dry-run' | 'imported' | 'already-there' | 'rejected' | 'failed', detail?: string }[]>}
 */
export async function importVotes({ baseUrl, votes, apply, fetchImpl = fetch }) {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/who-votes/vote`
  const results = []
  for (const vote of votes) {
    if (!apply) {
      results.push({ vote, status: 'dry-run' })
      continue
    }
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: vote.questionId, voterId: vote.voterId, option: vote.option }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        results.push({ vote, status: 'rejected', detail: `HTTP ${response.status}${body?.error ? `: ${body.error}` : ''}` })
        continue
      }
      const body = await response.json().catch(() => ({}))
      results.push({ vote, status: body?.alreadyVoted ? 'already-there' : 'imported' })
    } catch (error) {
      results.push({ vote, status: 'failed', detail: error instanceof Error ? error.message : String(error) })
    }
  }
  return results
}
