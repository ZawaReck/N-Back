import { useEffect, useRef, useState } from 'react'
import { ResultsPanel } from './components/ResultsPanel'
import { StimulusDisplay } from './components/StimulusDisplay'
import type { Answer, AppStatus, Phase, Settings, TrialDefinition, TrialResult } from './types/nback'
import { createTrialSequence, downloadCsv, downloadJson, formatPercent, statusLabel, summarizeResults } from './utils/nback'
import './App.css'

const DEFAULT_SETTINGS: Settings = {
  nLevel: 1,
  stimulusDurationMs: 1500,
  isiMs: 500,
  responseDeadlineMs: 4000,
  practiceTrials: 6,
  mainTrials: 20,
}

function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<AppStatus>('idle')
  const [currentPhase, setCurrentPhase] = useState<Phase | null>(null)
  const [trialQueue, setTrialQueue] = useState<TrialDefinition[]>([])
  const [trialResults, setTrialResults] = useState<TrialResult[]>([])
  const [currentTrialIndex, setCurrentTrialIndex] = useState<number | null>(null)
  const [currentStimulusColor, setCurrentStimulusColor] = useState<TrialDefinition['stimulusColor'] | null>(null)
  const [stimulusVisible, setStimulusVisible] = useState(false)
  const [latestSummaryPhase, setLatestSummaryPhase] = useState<Phase | null>(null)
  const [instructions, setInstructions] = useState('開始前に設定を確認してください。F = 不一致、J = 一致です。')
  const [lastInputMessage, setLastInputMessage] = useState('まだ回答はありません。')

  const responseLockedRef = useRef(false)
  const trialStartTimeRef = useRef<number | null>(null)
  const activeTrialRef = useRef<TrialDefinition | null>(null)
  const currentTrialIndexRef = useRef<number | null>(null)
  const statusRef = useRef<AppStatus>('idle')
  const timersRef = useRef<number[]>([])

  const latestResults = latestSummaryPhase
    ? trialResults.filter((trial) => trial.phase === latestSummaryPhase)
    : []
  const latestSummary = latestResults.length > 0 ? summarizeResults(latestResults) : null

  const progressTotal =
    currentPhase === 'practice' ? settings.practiceTrials : currentPhase === 'main' ? settings.mainTrials : 0
  const progressValue = currentTrialIndex === null ? 0 : Math.min(currentTrialIndex + 1, progressTotal)

  function clearAllTimers() {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    timersRef.current = []
  }

  function resetPresentationState() {
    clearAllTimers()
    responseLockedRef.current = false
    trialStartTimeRef.current = null
    activeTrialRef.current = null
    currentTrialIndexRef.current = null
    setCurrentTrialIndex(null)
    setCurrentStimulusColor(null)
    setStimulusVisible(false)
  }

  function finalizeRun() {
    clearAllTimers()
    responseLockedRef.current = true
    activeTrialRef.current = null
    trialStartTimeRef.current = null
    setCurrentTrialIndex(null)
    setCurrentStimulusColor(null)
    setStimulusVisible(false)
    setStatus('finished')
    setInstructions('試行が終了しました。結果を確認し、必要ならログをダウンロードしてください。')
    setTrialQueue([])
  }

  function recordResponse(answer: Answer) {
    if (statusRef.current !== 'running' || responseLockedRef.current) {
      return
    }

    const trial = activeTrialRef.current
    const startedAt = trialStartTimeRef.current

    if (!trial || startedAt === null) {
      return
    }

    responseLockedRef.current = true
    const reactionTimeMs = Math.max(0, Math.round(performance.now() - startedAt))
    setLastInputMessage(`${answer === 'match' ? '一致' : '不一致'} を受付 (${reactionTimeMs} ms)`)

    setTrialResults((current) =>
      current.map((item) =>
        item.phase === trial.phase && item.trialIndex === trial.trialIndex
          ? {
              ...item,
              userAnswer: answer,
              isCorrect: item.correctAnswer === answer,
              isMiss: false,
              reactionTimeMs,
            }
          : item,
      ),
    )
  }

  function runTrial(trialIndex: number) {
    clearAllTimers()

    if (statusRef.current !== 'running' || trialIndex >= trialQueue.length) {
      finalizeRun()
      return
    }

    const trial = trialQueue[trialIndex]
    activeTrialRef.current = trial
    currentTrialIndexRef.current = trialIndex
    responseLockedRef.current = false
    trialStartTimeRef.current = performance.now()
    setCurrentTrialIndex(trialIndex)
    setCurrentStimulusColor(trial.stimulusColor)
    setStimulusVisible(true)
    setLastInputMessage('回答待ちです。F = 不一致、J = 一致')
    setInstructions(`試行 ${trial.trialIndex} を提示中です。F = 不一致、J = 一致`)

    timersRef.current.push(
      window.setTimeout(() => {
        setStimulusVisible(false)
      }, settings.stimulusDurationMs),
    )

    timersRef.current.push(
      window.setTimeout(() => {
        if (!responseLockedRef.current) {
          responseLockedRef.current = true
          setTrialResults((current) =>
            current.map((item) =>
              item.phase === trial.phase && item.trialIndex === trial.trialIndex
                ? {
                    ...item,
                    userAnswer: null,
                    isCorrect: false,
                    isMiss: true,
                    reactionTimeMs: null,
                  }
                : item,
            ),
          )
        }
      }, settings.responseDeadlineMs),
    )

    timersRef.current.push(
      window.setTimeout(() => {
        setStimulusVisible(false)
        runTrial(trialIndex + 1)
      }, settings.responseDeadlineMs + settings.isiMs),
    )
  }

  function startPhase(phase: Phase) {
    resetPresentationState()

    const trialCount = phase === 'practice' ? settings.practiceTrials : settings.mainTrials
    const sequence = createTrialSequence(phase, trialCount, settings.nLevel)
    const blankResults: TrialResult[] = sequence.map((trial) => ({
      ...trial,
      userAnswer: null,
      isCorrect: false,
      isMiss: false,
      reactionTimeMs: null,
    }))

    setTrialQueue(sequence)
    setCurrentPhase(phase)
    setLatestSummaryPhase(null)
    setTrialResults((current) => current.filter((trial) => trial.phase !== phase).concat(blankResults))
    setStatus('running')
    setLastInputMessage('回答待ちです。F = 不一致、J = 一致')
    setInstructions(
      phase === 'practice'
        ? '練習を開始しました。直前の N 個前と色が同じなら J、違えば F を押してください。'
        : '本試行を開始しました。各刺激に対して F または J で回答してください。',
    )
  }

  function pauseRun() {
    if (statusRef.current !== 'running') {
      return
    }

    clearAllTimers()
    setStatus('paused')
    setInstructions('一時停止中です。再開すると現在の試行を同じ刺激でやり直します。')
  }

  function resumeRun() {
    if (statusRef.current !== 'paused') {
      return
    }

    setStatus('running')
    const trialIndex = currentTrialIndexRef.current ?? 0
    setInstructions('再開しました。現在の試行を再提示します。')
    runTrial(trialIndex)
  }

  function resetAll() {
    resetPresentationState()
    setStatus('idle')
    setCurrentPhase(null)
    setTrialQueue([])
    setTrialResults([])
    setLatestSummaryPhase(null)
    setInstructions('開始前に設定を確認してください。F = 不一致、J = 一致です。')
    setLastInputMessage('まだ回答はありません。')
  }

  function handleSettingChange<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }))
  }

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (status === 'running' && trialQueue.length > 0 && currentTrialIndex === null) {
      runTrial(0)
    }
  }, [status, trialQueue, currentTrialIndex])

  useEffect(() => {
    if (status === 'running' && currentPhase) {
      const phaseResults = trialResults.filter((trial) => trial.phase === currentPhase)
      if (phaseResults.length > 0 && phaseResults.every((trial) => trial.isMiss || trial.userAnswer !== null)) {
        setLatestSummaryPhase(currentPhase)
      }
    }
  }, [trialResults, currentPhase, status])

  useEffect(() => {
    if (latestSummaryPhase && status === 'running') {
      const completedResults = trialResults.filter((trial) => trial.phase === latestSummaryPhase)
      if (completedResults.length > 0 && completedResults.every((trial) => trial.isMiss || trial.userAnswer !== null)) {
        finalizeRun()
      }
    }
  }, [latestSummaryPhase, trialResults, status])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return
      }

      if (event.isComposing) {
        return
      }

      const key = event.key.toLowerCase()
      const code = event.code

      if (code === 'KeyF' || key === 'f') {
        event.preventDefault()
        recordResponse('non-match')
      }

      if (code === 'KeyJ' || key === 'j') {
        event.preventDefault()
        recordResponse('match')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => () => clearAllTimers(), [])

  const canStart = status === 'idle' || status === 'finished'
  const canPause = status === 'running'
  const canResume = status === 'paused'
  const isMainFocusMode = currentPhase === 'main' && (status === 'running' || status === 'paused')
  const displayStimulusColor = stimulusVisible ? currentStimulusColor : null
  const focusStimulusColor =
    displayStimulusColor === 'red'
      ? '#e53935'
      : displayStimulusColor === 'blue'
        ? '#1e88e5'
        : displayStimulusColor === 'green'
          ? '#43a047'
          : displayStimulusColor === 'yellow'
            ? '#fdd835'
            : '#d7dbe4'

  return (
    <main className={`app-shell ${isMainFocusMode ? 'main-focus-mode' : ''}`}>
      <header className="hero-panel">
        <div>
          <p className="eyebrow">React + Vite + TypeScript</p>
          <h1>N-Back Task</h1>
          <p className="lead">
            PCブラウザで N-Back Task の流れを簡単に確認するための試作です。F キーで不一致、J キーで一致を回答できます。
          </p>
        </div>
        <div className="status-card">
          <span>状態</span>
          <strong>{statusLabel(status)}</strong>
          <p>{instructions}</p>
        </div>
      </header>

      <section className="panel">
        <h2>設定項目</h2>
        <div className="settings-grid">
          <label>
            <span>N-back レベル</span>
            <select
              value={settings.nLevel}
              disabled={status === 'running' || status === 'paused'}
              onChange={(event) => handleSettingChange('nLevel', Number(event.target.value) as Settings['nLevel'])}
            >
              <option value={1}>1-back</option>
              <option value={2}>2-back</option>
            </select>
          </label>
          <label>
            <span>刺激提示時間 (ms)</span>
            <input
              type="number"
              min={100}
              step={100}
              value={settings.stimulusDurationMs}
              disabled={status === 'running' || status === 'paused'}
              onChange={(event) => handleSettingChange('stimulusDurationMs', Number(event.target.value))}
            />
          </label>
          <label>
            <span>ISI (ms)</span>
            <input
              type="number"
              min={0}
              step={100}
              value={settings.isiMs}
              disabled={status === 'running' || status === 'paused'}
              onChange={(event) => handleSettingChange('isiMs', Number(event.target.value))}
            />
          </label>
          <label>
            <span>最大反応猶予 (ms)</span>
            <input
              type="number"
              min={100}
              step={100}
              value={settings.responseDeadlineMs}
              disabled={status === 'running' || status === 'paused'}
              onChange={(event) => handleSettingChange('responseDeadlineMs', Number(event.target.value))}
            />
          </label>
          <label>
            <span>練習試行数</span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.practiceTrials}
              disabled={status === 'running' || status === 'paused'}
              onChange={(event) => handleSettingChange('practiceTrials', Number(event.target.value))}
            />
          </label>
          <label>
            <span>本試行数</span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.mainTrials}
              disabled={status === 'running' || status === 'paused'}
              onChange={(event) => handleSettingChange('mainTrials', Number(event.target.value))}
            />
          </label>
        </div>
      </section>

      <div className="main-grid">
        <StimulusDisplay color={displayStimulusColor} visible={stimulusVisible} />

        <section className="panel">
          <h2>操作</h2>
          <div className="progress-box">
            <span>進捗</span>
            <strong>
              {progressValue} / {progressTotal}
            </strong>
            <p>
              {currentPhase ? `${currentPhase === 'practice' ? '練習' : '本試行'} / ${settings.nLevel}-back` : '未開始'}
            </p>
            <p>{status === 'paused' ? '再開すると現在の試行を再提示します。' : '回答は F または J で行います。'}</p>
            <p>{currentTrialIndex !== null && currentTrialIndex < settings.nLevel ? '冒頭試行は評価対象外です。' : 'N 個前との一致/不一致を判定します。'}</p>
            <p>入力受付: {lastInputMessage}</p>
          </div>

          <div className="button-row">
            <button disabled={!canStart} onClick={() => startPhase('practice')}>
              練習開始
            </button>
            <button disabled={!canStart} onClick={() => startPhase('main')}>
              本試行開始
            </button>
            <button disabled={!canPause} onClick={pauseRun}>
              一時停止
            </button>
            <button disabled={!canResume} onClick={resumeRun}>
              再開
            </button>
            <button onClick={resetAll}>リセット</button>
          </div>

          <div className="response-buttons">
            <button className="secondary" disabled={status !== 'running'} onClick={() => recordResponse('non-match')}>
              不一致 (F)
            </button>
            <button className="primary" disabled={status !== 'running'} onClick={() => recordResponse('match')}>
              一致 (J)
            </button>
          </div>

          <div className="hint-list">
            <p>入力方法: F = 不一致 / J = 一致</p>
            <p>同一試行では最初の入力のみ受け付けます。</p>
            <p>反応がない場合は自動で miss になります。</p>
          </div>
        </section>
      </div>

      <ResultsPanel
        phaseLabel={latestSummaryPhase === 'practice' ? '練習' : latestSummaryPhase === 'main' ? '本試行' : '-'}
        summary={latestSummary}
        latestTrials={latestResults}
      />

      <section className="panel export-panel">
        <h2>データ出力</h2>
        <p className="muted">
          現在保持している試行ログをダウンロードできます。練習・本試行の両方を含みます。
        </p>
        <div className="button-row">
          <button
            disabled={trialResults.length === 0}
            onClick={() =>
              downloadJson(`nback-log-${new Date().toISOString().replaceAll(':', '-')}.json`, {
                exportedAt: new Date().toISOString(),
                settings,
                trials: trialResults,
              })
            }
          >
            JSON ダウンロード
          </button>
          <button
            disabled={trialResults.length === 0}
            onClick={() => downloadCsv(`nback-log-${new Date().toISOString().replaceAll(':', '-')}.csv`, trialResults)}
          >
            CSV ダウンロード
          </button>
        </div>
        <p className="muted">
          累積ログ件数: {trialResults.length} 件 / 最新結果の正答率: {formatPercent(latestSummary?.accuracy ?? null)}
        </p>
      </section>

      {isMainFocusMode ? (
        <section className="focus-overlay" aria-live="polite">
          <div className="focus-topbar">
            <div className="focus-chip">
              <span>進捗</span>
              <strong>
                {progressValue} / {progressTotal}
              </strong>
            </div>
            <div className="focus-chip">
              <span>状態</span>
              <strong>{statusLabel(status)}</strong>
            </div>
            <div className="focus-chip">
              <span>入力</span>
              <strong>F = 不一致 / J = 一致</strong>
            </div>
          </div>

          <div className="focus-center">
            <div className={`focus-stimulus-stage ${stimulusVisible ? 'visible' : 'hidden'}`}>
              <div className="focus-stimulus-circle" style={{ backgroundColor: focusStimulusColor }} />
            </div>
          </div>

          <div className="focus-bottombar">
            <p>{instructions}</p>
            <div className="button-row">
              <button disabled={!canPause} onClick={pauseRun}>
                一時停止
              </button>
              <button disabled={!canResume} onClick={resumeRun}>
                再開
              </button>
              <button className="secondary" disabled={status !== 'running'} onClick={() => recordResponse('non-match')}>
                不一致 (F)
              </button>
              <button className="primary" disabled={status !== 'running'} onClick={() => recordResponse('match')}>
                一致 (J)
              </button>
              <button onClick={resetAll}>中止してリセット</button>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
