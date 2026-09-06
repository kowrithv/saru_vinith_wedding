import { promises as fs } from 'fs'
import path from 'path'
import { whoQuestions, whoGameOptions } from '@/lib/config'
import { generateId } from '@/lib/utils'
import type { WhoVoteRecord } from '@/types'

export interface WhoQuestionState {
  tally: Record<string, number>
  correctAnswer: string | null
  revealed: boolean
}

export interface WhoGameData {
  questions: Record<string, WhoQuestionState>
  votes: WhoVoteRecord[]
}

export type PublicWhoGameData = Pick<WhoGameData, 'questions'>

const DATA_FILE = path.join(process.cwd(), 'data', 'who-votes.json')

function emptyState(): WhoQuestionState {
  return {
    tally: Object.fromEntries(whoGameOptions.map((option) => [option, 0])),
    correctAnswer: null,
    revealed: false,
  }
}

function defaultData(): WhoGameData {
  return {
    questions: Object.fromEntries(whoQuestions.map((q) => [q.id, emptyState()])),
    votes: [],
  }
}

export async function readWhoGame(): Promise<WhoGameData> {
  const base = defaultData()
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WhoGameData>
    for (const [id, state] of Object.entries(parsed.questions ?? {})) {
      if (!base.questions[id]) continue
      base.questions[id] = {
        tally: { ...base.questions[id].tally, ...state?.tally },
        correctAnswer: typeof state?.correctAnswer === 'string' ? state.correctAnswer : null,
        revealed: Boolean(state?.revealed),
      }
    }
    base.votes = Array.isArray(parsed.votes) ? parsed.votes : []
    return base
  } catch {
    return base
  }
}

export async function readPublicWhoGame(): Promise<PublicWhoGameData> {
  const { questions } = await readWhoGame()
  return { questions }
}

async function writeWhoGame(data: WhoGameData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export async function castVote(
  questionId: string,
  option: string,
  voterName: string
): Promise<WhoGameData> {
  if (!whoQuestions.some((q) => q.id === questionId)) {
    throw new Error('Unbekannte Frage.')
  }
  if (!whoGameOptions.includes(option)) {
    throw new Error('Unbekannte Antwort.')
  }
  const data = await readWhoGame()
  const state = data.questions[questionId] ?? emptyState()
  state.tally[option] = (state.tally[option] ?? 0) + 1
  data.questions[questionId] = state
  data.votes.push({
    id: generateId(),
    questionId,
    option,
    voterName: voterName.trim().slice(0, 60) || 'Anonym',
    createdAt: new Date().toISOString(),
  })
  await writeWhoGame(data)
  return data
}

export async function setReveal(
  questionId: string,
  correctAnswer: string | null,
  revealed: boolean
): Promise<WhoGameData> {
  if (!whoQuestions.some((q) => q.id === questionId)) {
    throw new Error('Unbekannte Frage.')
  }
  const data = await readWhoGame()
  const state = data.questions[questionId] ?? emptyState()
  state.correctAnswer = correctAnswer
  state.revealed = revealed
  data.questions[questionId] = state
  await writeWhoGame(data)
  return data
}
