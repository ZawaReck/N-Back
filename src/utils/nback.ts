import type {
  Answer,
  Phase,
  RunSummary,
  Settings,
  StimulusColor,
  TrialDefinition,
  TrialResult,
} from '../types/nback'

const COLORS: StimulusColor[] = ['red', 'blue', 'green', 'yellow']
const TARGET_MATCH_RATE = 0.35

function randomColor(excluded?: StimulusColor): StimulusColor {
  const pool = excluded ? COLORS.filter((color) => color !== excluded) : COLORS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function createTrialSequence(
  phase: Phase,
  trialCount: number,
  nLevel: Settings['nLevel'],
): TrialDefinition[] {
  const sequence: TrialDefinition[] = []
  const colors: StimulusColor[] = []
  let matchCount = 0

  for (let index = 0; index < trialCount; index += 1) {
    const canMatch = index >= nLevel
    const trialsWithAnswer = Math.max(1, index - nLevel + 1)
    const currentMatchRate = matchCount / trialsWithAnswer
    const shouldMatch =
      canMatch &&
      (currentMatchRate < TARGET_MATCH_RATE
        ? Math.random() < 0.5
        : Math.random() < TARGET_MATCH_RATE)

    const color = shouldMatch ? colors[index - nLevel] : randomColor(canMatch ? colors[index - nLevel] : undefined)

    if (shouldMatch) {
      matchCount += 1
    }

    colors.push(color)
    sequence.push({
      trialIndex: index + 1,
      phase,
      nLevel,
      stimulusColor: color,
      correctAnswer: shouldMatch ? 'match' : 'non-match',
      isScored: canMatch,
    })
  }

  return sequence
}

export function summarizeResults(results: TrialResult[]): RunSummary {
  const totalTrials = results.length
  const scoredResults = results.filter((trial) => trial.isScored)
  const scoredTrials = scoredResults.length
  const correctCount = scoredResults.filter((trial) => trial.isCorrect).length
  const missCount = scoredResults.filter((trial) => trial.isMiss).length
  const answeredTrials = scoredResults.filter((trial) => !trial.isMiss && trial.reactionTimeMs !== null)
  const matchTrials = scoredResults.filter((trial) => trial.correctAnswer === 'match')
  const nonMatchTrials = scoredResults.filter((trial) => trial.correctAnswer === 'non-match')
  const correctMatchTrials = matchTrials.filter((trial) => trial.isCorrect).length
  const correctNonMatchTrials = nonMatchTrials.filter((trial) => trial.isCorrect).length

  const averageReactionTimeMs =
    answeredTrials.length > 0
      ? Math.round(
          answeredTrials.reduce((sum, trial) => sum + (trial.reactionTimeMs ?? 0), 0) / answeredTrials.length,
        )
      : null

  return {
    totalTrials,
    scoredTrials,
    correctCount,
    accuracy: scoredTrials > 0 ? correctCount / scoredTrials : 0,
    missCount,
    missRate: scoredTrials > 0 ? missCount / scoredTrials : 0,
    averageReactionTimeMs,
    matchAccuracy: matchTrials.length > 0 ? correctMatchTrials / matchTrials.length : null,
    nonMatchAccuracy: nonMatchTrials.length > 0 ? correctNonMatchTrials / nonMatchTrials.length : null,
  }
}

export function formatPercent(value: number | null): string {
  if (value === null) {
    return '-'
  }

  return `${(value * 100).toFixed(1)}%`
}

export function answerLabel(answer: Answer | null): string {
  if (answer === 'match') {
    return '一致'
  }

  if (answer === 'non-match') {
    return '不一致'
  }

  return '-'
}

export function colorLabel(color: StimulusColor): string {
  const labels: Record<StimulusColor, string> = {
    red: '赤',
    blue: '青',
    green: '緑',
    yellow: '黄',
  }

  return labels[color]
}

export function statusLabel(status: 'idle' | 'running' | 'paused' | 'finished'): string {
  const labels = {
    idle: 'idle / 待機中',
    running: 'running / 実行中',
    paused: 'paused / 一時停止',
    finished: 'finished / 終了',
  }

  return labels[status]
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, trials: TrialResult[]): void {
  const header = [
    'trialIndex',
    'phase',
    'nLevel',
    'stimulusColor',
    'correctAnswer',
    'userAnswer',
    'isCorrect',
    'isMiss',
    'reactionTimeMs',
  ]

  const rows = trials.map((trial) =>
    [
      trial.trialIndex,
      trial.phase,
      trial.nLevel,
      trial.stimulusColor,
      trial.correctAnswer,
      trial.userAnswer ?? '',
      trial.isCorrect,
      trial.isMiss,
      trial.reactionTimeMs ?? '',
    ].join(','),
  )

  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
