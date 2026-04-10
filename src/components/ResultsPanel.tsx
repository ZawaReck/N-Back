import type { RunSummary, TrialResult } from '../types/nback'
import { answerLabel, formatPercent } from '../utils/nback'

type ResultsPanelProps = {
  phaseLabel: string
  summary: RunSummary | null
  latestTrials: TrialResult[]
}

export function ResultsPanel({ phaseLabel, summary, latestTrials }: ResultsPanelProps) {
  return (
    <section className="panel">
      <h2>結果表示</h2>
      {!summary ? (
        <p className="muted">まだ結果はありません。練習または本試行を開始してください。</p>
      ) : (
        <>
          <div className="summary-grid">
            <div>
              <span>対象</span>
              <strong>{phaseLabel}</strong>
            </div>
            <div>
              <span>総試行数</span>
              <strong>{summary.totalTrials}</strong>
            </div>
            <div>
              <span>評価対象試行数</span>
              <strong>{summary.scoredTrials}</strong>
            </div>
            <div>
              <span>正答数</span>
              <strong>{summary.correctCount}</strong>
            </div>
            <div>
              <span>正答率</span>
              <strong>{formatPercent(summary.accuracy)}</strong>
            </div>
            <div>
              <span>miss数</span>
              <strong>{summary.missCount}</strong>
            </div>
            <div>
              <span>miss率</span>
              <strong>{formatPercent(summary.missRate)}</strong>
            </div>
            <div>
              <span>平均反応時間</span>
              <strong>{summary.averageReactionTimeMs === null ? '-' : `${summary.averageReactionTimeMs} ms`}</strong>
            </div>
            <div>
              <span>一致試行の正答率</span>
              <strong>{formatPercent(summary.matchAccuracy)}</strong>
            </div>
            <div>
              <span>不一致試行の正答率</span>
              <strong>{formatPercent(summary.nonMatchAccuracy)}</strong>
            </div>
          </div>

          <div className="trial-table-wrapper">
            <table className="trial-table">
              <thead>
                <tr>
                  <th>試行</th>
                  <th>正解</th>
                  <th>回答</th>
                  <th>正誤</th>
                  <th>RT</th>
                </tr>
              </thead>
              <tbody>
                {latestTrials.slice(-8).map((trial) => (
                  <tr key={`${trial.phase}-${trial.trialIndex}`}>
                    <td>{trial.trialIndex}</td>
                    <td>{trial.isScored ? answerLabel(trial.correctAnswer) : '該当なし'}</td>
                    <td>{trial.isScored ? (trial.isMiss ? 'miss' : answerLabel(trial.userAnswer)) : '-'}</td>
                    <td>{trial.isScored ? (trial.isCorrect ? '正答' : '誤答') : '対象外'}</td>
                    <td>{trial.reactionTimeMs === null ? '-' : `${trial.reactionTimeMs} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
