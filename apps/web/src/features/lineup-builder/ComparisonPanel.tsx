import type { RepairedLineupResponse, RosterPlayerDto } from '@lineup-engine/shared';

import { intentMetrics } from './intent-config.ts';

interface ComparisonPanelProps {
  response: RepairedLineupResponse;
  roster: RosterPlayerDto[];
}

function nameFor(playerId: string, roster: RosterPlayerDto[]): string {
  return roster.find((player) => player.id === playerId)?.name ?? playerId;
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta}`;
}

export function ComparisonPanel({ response, roster }: ComparisonPanelProps) {
  const { repair } = response;
  const metricLabels = new Map(intentMetrics);
  return (
    <section className="comparison-card" aria-labelledby="comparison-title">
      <span className="panel-kicker">Before and after</span>
      <h2 id="comparison-title">
        {repair.swapCount === 0
          ? 'This five already meets the new intent.'
          : `${repair.swapCount} ${repair.swapCount === 1 ? 'swap' : 'swaps'} made.`}
      </h2>

      {repair.swapCount > 0 && (
        <div className="swap-summary">
          <div>
            <span>Out</span>
            <strong>{repair.removedPlayerIds.map((id) => nameFor(id, roster)).join(' · ')}</strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span>In</span>
            <strong>{repair.addedPlayerIds.map((id) => nameFor(id, roster)).join(' · ')}</strong>
          </div>
        </div>
      )}

      {(repair.comparison.largestGain || repair.comparison.largestTradeoff) && (
        <div className="tradeoff-summary">
          {repair.comparison.largestGain && (
            <div className="tradeoff tradeoff--gain">
              <span>Largest gain</span>
              <strong>{metricLabels.get(repair.comparison.largestGain.metric)}</strong>
              <small>{formatDelta(repair.comparison.largestGain.delta)} points</small>
            </div>
          )}
          {repair.comparison.largestTradeoff && (
            <div className="tradeoff tradeoff--loss">
              <span>Largest tradeoff</span>
              <strong>{metricLabels.get(repair.comparison.largestTradeoff.metric)}</strong>
              <small>{formatDelta(repair.comparison.largestTradeoff.delta)} points</small>
            </div>
          )}
        </div>
      )}

      <div className="comparison-grid">
        <div className="comparison-row comparison-row--header">
          <span>Metric</span>
          <span>Before</span>
          <span>After</span>
          <span>Change</span>
        </div>
        {repair.comparison.metrics.map((metric) => (
          <div className="comparison-row" key={metric.metric}>
            <strong>{metricLabels.get(metric.metric)}</strong>
            <span>{metric.before}</span>
            <span>{metric.after}</span>
            <span
              className={metric.delta > 0 ? 'is-positive' : metric.delta < 0 ? 'is-negative' : ''}
            >
              {formatDelta(metric.delta)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
