export type AppStatus = 'idle' | 'running' | 'paused' | 'finished'
export type Phase = 'practice' | 'main'
export type StimulusColor = 'red' | 'blue' | 'green' | 'yellow'
export type Answer = 'match' | 'non-match'

export type Settings = {
  nLevel: 1 | 2
  stimulusDurationMs: number
  isiMs: number
  responseDeadlineMs: number
  practiceTrials: number
  mainTrials: number
}

export type TrialDefinition = {
  trialIndex: number
  phase: Phase
  nLevel: number
  stimulusColor: StimulusColor
  correctAnswer: Answer
  isScored: boolean
}

export type TrialResult = TrialDefinition & {
  userAnswer: Answer | null
  isCorrect: boolean
  isMiss: boolean
  reactionTimeMs: number | null
}

export type RunSummary = {
  totalTrials: number
  scoredTrials: number
  correctCount: number
  accuracy: number
  missCount: number
  missRate: number
  averageReactionTimeMs: number | null
  matchAccuracy: number | null
  nonMatchAccuracy: number | null
}
