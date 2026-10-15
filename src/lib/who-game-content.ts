import { couple } from './site-content'

export interface WhoQuestion {
  id: string
  question: string
}

/** Die Antwort "beide": wird mit dem gemeinsamen Foto gezeigt. */
export const whoBoth = 'Beide'

// Die Antwortmöglichkeiten sind für alle Fragen identisch.
export const whoGameOptions: string[] = [couple.bride, couple.groom, whoBoth]

export const whoQuestions: WhoQuestion[] = [
  { id: '1', question: 'Wer hat beim ersten Treffen mehr geredet?' },
  { id: '2', question: 'Wer hatte beim ersten Treffen den besseren ersten Eindruck vom anderen?' },
  { id: '3', question: 'Wer hat zuerst geschrieben?' },
  { id: '4', question: 'Wer braucht länger, um sich fertig zu machen?' },
  { id: '5', question: 'Wer ist romantischer?' },
  { id: '6', question: 'Wer plant lieber alles im Voraus?' },
  { id: '7', question: 'Wer ist spontaner?' },
  { id: '8', question: 'Wer entschuldigt sich nach einem Streit zuerst?' },
  { id: '9', question: 'Wer kann schlechter verlieren?' },
  { id: '10', question: 'Wer klaut dem anderen Essen vom Teller?' },
  { id: '11', question: 'Wer schläft schneller ein?' },
  { id: '12', question: 'Wer ist morgens besser gelaunt?' },
  { id: '13', question: 'Wer ist ordentlicher?' },
  { id: '14', question: 'Wer ist der größere Dickkopf?' },
]
