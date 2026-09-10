import type { LineupAnalysisResponse, RosterPlayerDto } from '@lineup-engine/shared';

import { MetricCard } from './MetricCard.tsx';

interface AnalysisPanelProps {
  analysis: LineupAnalysisResponse | undefined;
  error: string | undefined;
  isPending: boolean;
  roster: RosterPlayerDto[];
  selectedPlayerIds: string[];
}

const metricDefinitions = [
  ['shooting', 'Shooting'],
  ['creation', 'Creation'],
  ['playmaking', 'Playmaking'],
  ['rebounding', 'Rebounding'],
  ['perimeterDefense', 'Perimeter defense'],
  ['interiorDefense', 'Interior defense'],
  ['switchability', 'Switchability'],
] as const;

function SelectedFive({
  roster,
  selectedPlayerIds,
}: Pick<AnalysisPanelProps, 'roster' | 'selectedPlayerIds'>) {
  const selectedPlayers = selectedPlayerIds.map((playerId) =>
    roster.find((player) => player.id === playerId),
  );

  return (
    <ol className="selected-five" aria-label="Selected lineup">
      {Array.from({ length: 5 }, (_, index) => {
        const player = selectedPlayers[index];
        return (
          <li key={player?.id ?? `open-${index}`} className={player ? 'is-filled' : ''}>
            <span>{index + 1}</span>
            <div>
              <strong>{player?.name ?? 'Open roster spot'}</strong>
              <small>{player?.position ?? 'Select a player'}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AnalysisPanel({
  analysis,
  error,
  isPending,
  roster,
  selectedPlayerIds,
}: AnalysisPanelProps) {
  if (isPending) {
    return (
      <section className="analysis-card analysis-loading" aria-live="polite">
        <span className="analysis-orbit" aria-hidden="true" />
        <div className="eyebrow">Evaluating lineup</div>
        <h2>Running deterministic checks…</h2>
        <p>Scoring seven dimensions and deriving evidence-backed findings.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="analysis-card analysis-error" role="alert">
        <div className="eyebrow">Analysis unavailable</div>
        <h2>We couldn’t evaluate that five.</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="analysis-card analysis-empty">
        <div className="empty-court" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="eyebrow">Your five</div>
        <h2>Build the lineup, then inspect the fit.</h2>
        <p>
          Select five players from the roster. The server-side engine will evaluate the lineup and
          explain every score.
        </p>
        <SelectedFive roster={roster} selectedPlayerIds={selectedPlayerIds} />
      </section>
    );
  }

  const strengths = analysis.analysis.findings.filter((finding) => finding.severity === 'strength');
  const concerns = analysis.analysis.findings.filter((finding) => finding.severity === 'concern');

  return (
    <section className="analysis-card analysis-results" aria-labelledby="analysis-title">
      <div className="analysis-header">
        <div>
          <div className="eyebrow">Lineup analysis</div>
          <h2 id="analysis-title">How this five fits together.</h2>
        </div>
        <span className="verified-pill">
          <span aria-hidden="true">✓</span> Valid five
        </span>
      </div>

      <SelectedFive roster={roster} selectedPlayerIds={analysis.lineup.playerIds} />

      <div className="metric-grid">
        {metricDefinitions.map(([key, label]) => (
          <MetricCard key={key} label={label} metric={analysis.analysis[key]} />
        ))}
      </div>

      <div className="findings-grid">
        <div>
          <h3>What works</h3>
          {strengths.length === 0 ? (
            <p className="no-findings">No standout strengths crossed the current thresholds.</p>
          ) : (
            strengths.map((finding) => (
              <article className="finding finding--strength" key={finding.id}>
                <span aria-hidden="true">↑</span>
                <div>
                  <strong>{finding.title}</strong>
                  <p>{finding.description}</p>
                </div>
              </article>
            ))
          )}
        </div>
        <div>
          <h3>Watch closely</h3>
          {concerns.length === 0 ? (
            <p className="no-findings">No material concerns crossed the current thresholds.</p>
          ) : (
            concerns.map((finding) => (
              <article className="finding finding--concern" key={finding.id}>
                <span aria-hidden="true">!</span>
                <div>
                  <strong>{finding.title}</strong>
                  <p>{finding.description}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
