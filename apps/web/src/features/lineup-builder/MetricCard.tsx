import type { MetricScoreDto } from '@lineup-engine/shared';

interface MetricCardProps {
  label: string;
  metric: MetricScoreDto;
}

function formatAdjustment(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function MetricCard({ label, metric }: MetricCardProps) {
  return (
    <details className="metric-card">
      <summary>
        <div className="metric-heading">
          <span>{label}</span>
          <strong>{Math.round(metric.score)}</strong>
        </div>
        <div className="metric-track" aria-hidden="true">
          <span style={{ width: `${metric.score}%` }} />
        </div>
        <span className="metric-inspect">Inspect evidence</span>
      </summary>
      <div className="metric-evidence">
        {metric.evidence.map((item) => (
          <div className={`evidence-row evidence-row--${item.kind}`} key={item.id}>
            <div>
              <span>{item.label}</span>
              <small>{item.description}</small>
            </div>
            <strong>
              {item.kind === 'rule-adjustment'
                ? formatAdjustment(item.value)
                : Math.round(item.value)}
            </strong>
          </div>
        ))}
      </div>
    </details>
  );
}
