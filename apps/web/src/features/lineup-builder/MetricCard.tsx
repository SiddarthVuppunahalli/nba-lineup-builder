import type { MetricEvidenceDto, MetricScoreDto } from '@lineup-engine/shared';

interface MetricCardProps {
  label: string;
  metric: MetricScoreDto;
}

function formatAdjustment(value: number): string {
  return value > 0 ? `+${formatScore(value)}` : formatScore(value);
}

const formatScore = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value);

function EvidenceRow({ item }: { item: MetricEvidenceDto }) {
  return (
    <div className={`evidence-row evidence-row--${item.kind}`}>
      <div>
        <span>{item.label}</span>
        <small>{item.description}</small>
      </div>
      <strong>
        {item.kind === 'rule-adjustment' ? formatAdjustment(item.value) : formatScore(item.value)}
      </strong>
    </div>
  );
}

export function MetricCard({ label, metric }: MetricCardProps) {
  const calculation = metric.evidence.filter((item) => item.kind !== 'player-score');
  const playerRatings = metric.evidence.filter((item) => item.kind === 'player-score');
  return (
    <details className="metric-card">
      <summary>
        <div className="metric-heading">
          <span>{label}</span>
          <strong>{formatScore(metric.score)}</strong>
        </div>
        <div className="metric-track" aria-hidden="true">
          <span style={{ width: `${metric.score}%` }} />
        </div>
        <span className="metric-inspect">Inspect evidence</span>
      </summary>
      <div className="metric-evidence">
        <h3>How it’s calculated</h3>
        {calculation.map((item) => (
          <EvidenceRow key={item.id} item={item} />
        ))}
        <div className="metric-total">
          <span>Final score</span>
          <strong>{formatScore(metric.score)} / 100</strong>
        </div>
        <p className="metric-note">
          Contributions and adjustments are added, limited to 0–100, and rounded to one decimal.
        </p>
        <h3>Player ratings</h3>
        {playerRatings.map((item) => (
          <EvidenceRow key={item.id} item={item} />
        ))}
      </div>
    </details>
  );
}
