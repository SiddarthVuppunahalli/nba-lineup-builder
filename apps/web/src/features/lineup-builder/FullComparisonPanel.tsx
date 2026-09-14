import type { ComparedLineupsResponse, RosterPlayerDto } from '@lineup-engine/shared';

import { intentMetrics } from './intent-config.ts';

interface FullComparisonPanelProps {
  response: ComparedLineupsResponse;
  beforeName: string;
  afterName: string;
  roster: RosterPlayerDto[];
}

function formatDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${delta}`;
}

export function FullComparisonPanel({
  response,
  beforeName,
  afterName,
  roster,
}: FullComparisonPanelProps) {
  const result = response.comparison;
  const metricLabels = new Map(intentMetrics);
  const playerName = (id: string) => roster.find((player) => player.id === id)?.name ?? id;
  const constraintIds = [
    ...new Set([
      ...result.before.constraints.map((constraint) => constraint.id),
      ...result.after.constraints.map((constraint) => constraint.id),
    ]),
  ];

  return (
    <section className="comparison-card full-comparison" aria-labelledby="full-comparison-title">
      <span className="panel-kicker">Version comparison</span>
      <h2 id="full-comparison-title">
        {beforeName} <span aria-hidden="true">→</span> {afterName}
      </h2>

      <div className="comparison-lineups">
        <div>
          <span>Out</span>
          <strong>
            {result.removedPlayerIds.length
              ? result.removedPlayerIds.map(playerName).join(' · ')
              : 'No players removed'}
          </strong>
        </div>
        <div>
          <span>In</span>
          <strong>
            {result.addedPlayerIds.length
              ? result.addedPlayerIds.map(playerName).join(' · ')
              : 'No players added'}
          </strong>
        </div>
        <div>
          <span>Kept</span>
          <strong>{result.retainedPlayerIds.map(playerName).join(' · ')}</strong>
        </div>
      </div>

      <div className="comparison-fit" aria-label="Weighted fit comparison">
        <div>
          <span>{beforeName}</span>
          <strong>{result.before.objectiveScore}</strong>
        </div>
        <div>
          <span>{afterName}</span>
          <strong>{result.after.objectiveScore}</strong>
        </div>
        <p>
          Weighted fit uses the priorities selected for this comparison.
          {response.usedBalancedDefault ? ' Balanced priorities replaced all-zero weights.' : ''}
        </p>
      </div>

      {(result.comparison.largestGain || result.comparison.largestTradeoff) && (
        <div className="tradeoff-summary">
          {result.comparison.largestGain && (
            <div className="tradeoff tradeoff--gain">
              <span>Largest gain</span>
              <strong>{metricLabels.get(result.comparison.largestGain.metric)}</strong>
              <small>{formatDelta(result.comparison.largestGain.delta)} points</small>
            </div>
          )}
          {result.comparison.largestTradeoff && (
            <div className="tradeoff tradeoff--loss">
              <span>Largest tradeoff</span>
              <strong>{metricLabels.get(result.comparison.largestTradeoff.metric)}</strong>
              <small>{formatDelta(result.comparison.largestTradeoff.delta)} points</small>
            </div>
          )}
        </div>
      )}

      <div className="comparison-grid">
        <div className="comparison-row comparison-row--header">
          <span>Metric</span>
          <span>{beforeName}</span>
          <span>{afterName}</span>
          <span>Change</span>
        </div>
        {result.comparison.metrics.map((metric) => (
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

      <div className="constraint-comparison">
        <h3>Requirement satisfaction</h3>
        <div className="constraint-comparison__header">
          <span>Requirement</span>
          <span>{beforeName}</span>
          <span>{afterName}</span>
        </div>
        {constraintIds.map((id) => {
          const before = result.before.constraints.find((constraint) => constraint.id === id);
          const after = result.after.constraints.find((constraint) => constraint.id === id);
          return (
            <div className="constraint-comparison__row" key={id}>
              <strong>{before?.label ?? after?.label}</strong>
              <span className={before?.satisfied ? 'is-positive' : 'is-negative'}>
                {before?.satisfied ? '✓ Meets' : '× Misses'}
              </span>
              <span className={after?.satisfied ? 'is-positive' : 'is-negative'}>
                {after?.satisfied ? '✓ Meets' : '× Misses'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
