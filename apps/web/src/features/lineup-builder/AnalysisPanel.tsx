import type {
  ConstraintResultDto,
  LineupSearchMetadataDto,
  LineupAnalysisResponse,
  RosterPlayerDto,
} from '@lineup-engine/shared';
import { useEffect, useRef } from 'react';

import { MetricCard } from './MetricCard.tsx';
import { SessionVersionSave } from './SessionVersionSave.tsx';

interface AnalysisPanelProps {
  analysis: LineupAnalysisResponse | undefined;
  error: string | undefined;
  errorDetails?: string[];
  isPending: boolean;
  roster: RosterPlayerDto[];
  selectedPlayerIds: string[];
  onRetry: () => void;
  canRetry: boolean;
  mode?: 'manual' | 'generation' | 'repair';
  revealOnSuccess?: boolean;
  onBackToEditing?: () => void;
  onRepair?: () => void;
  onCompare?: () => void;
  resultContext?:
    | {
        objectiveScore: number;
        constraints: ConstraintResultDto[];
        evaluatedCandidateCount: number;
        validCandidateCount: number;
        usedBalancedDefault: boolean;
        search?: LineupSearchMetadataDto;
      }
    | undefined;
  versionSave?:
    | {
        suggestedName: string;
        onSave: (name: string) => void;
      }
    | undefined;
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
  errorDetails = [],
  isPending,
  roster,
  selectedPlayerIds,
  onRetry,
  canRetry,
  mode = 'manual',
  revealOnSuccess = false,
  onBackToEditing,
  onRepair,
  onCompare,
  resultContext,
  versionSave,
}: AnalysisPanelProps) {
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!analysis || !revealOnSuccess || !resultHeadingRef.current) return;
    const heading = resultHeadingRef.current;
    heading.focus({ preventScroll: true });
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion && typeof heading.scrollIntoView === 'function') {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [analysis, revealOnSuccess]);

  if (isPending) {
    return (
      <section className="analysis-card analysis-loading" aria-live="polite">
        <span className="analysis-orbit" aria-hidden="true" />
        <div className="eyebrow">
          {mode === 'generation'
            ? 'Searching the roster'
            : mode === 'repair'
              ? 'Adapting your five'
              : 'Evaluating lineup'}
        </div>
        <h2>
          {mode === 'generation'
            ? 'Finding the best five for your intent…'
            : mode === 'repair'
              ? 'Finding the smallest valid change…'
              : 'Finding the strengths in your five…'}
        </h2>
        <p>
          {mode === 'generation'
            ? 'Evaluating every eligible combination against your priorities and requirements.'
            : mode === 'repair'
              ? 'Checking valid alternatives while preserving as much of your lineup as possible.'
              : 'Looking at shooting, creation, defense, and how your players fit together.'}
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="analysis-card analysis-error" role="alert">
        <div className="eyebrow">
          {mode === 'generation'
            ? 'No valid lineup'
            : mode === 'repair'
              ? 'No valid repair'
              : 'Analysis unavailable'}
        </div>
        <h2>
          {mode === 'generation' || mode === 'repair'
            ? 'Those requirements don’t fit this roster.'
            : 'We couldn’t evaluate that five.'}
        </h2>
        <p>{error}</p>
        {errorDetails.length > 0 && (
          <ul className="error-details">
            {errorDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
        <button className="retry-button" type="button" onClick={onRetry} disabled={!canRetry}>
          {mode === 'generation'
            ? 'Retry generation'
            : mode === 'repair'
              ? 'Retry repair'
              : 'Retry analysis'}
        </button>
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
        <div className="eyebrow">
          {mode === 'generation'
            ? 'Your intent'
            : mode === 'repair'
              ? 'Your starting five'
              : 'Your five'}
        </div>
        <h2>
          {mode === 'generation'
            ? 'Set the rules. We’ll search every five.'
            : mode === 'repair'
              ? 'Choose what needs to change.'
              : 'Build the lineup, then inspect the fit.'}
        </h2>
        <p>
          {mode === 'generation'
            ? 'Balance ranking preferences with hard requirements, then inspect why the winning lineup fits.'
            : mode === 'repair'
              ? 'Set new requirements to find the fewest necessary swaps and understand each tradeoff.'
              : 'Select five players from the roster to discover what works, where you give something up, and why.'}
        </p>
        <SelectedFive roster={roster} selectedPlayerIds={selectedPlayerIds} />
      </section>
    );
  }

  const strengths = analysis.analysis.findings.filter((finding) => finding.severity === 'strength');
  const concerns = analysis.analysis.findings.filter((finding) => finding.severity === 'concern');
  const solverSummary =
    resultContext?.search?.strategy === 'cp-sat'
      ? resultContext.search.solverStatus === 'optimal'
        ? ` CP-SAT considered all ${resultContext.search.searchedPlayerCount} eligible players and proved this result optimal in ${resultContext.search.elapsedMs ?? 0} ms.`
        : ` CP-SAT modeled all ${resultContext.search.searchedPlayerCount} eligible players and stopped within its ${resultContext.search.timeLimitMs ?? 0} ms budget. This is the best retained candidate, not a proven optimum.${resultContext.search.incumbentSource === 'bounded-seed' ? ' The solver retained the deterministic 18-player seed because it did not prove an improvement.' : ''}${resultContext.search.objectiveBound !== undefined ? ` The proven fit bound is ${resultContext.search.objectiveBound}${resultContext.search.objectiveGap !== undefined ? ` (${(resultContext.search.objectiveGap * 100).toFixed(2)}% gap)` : ''}.` : ''}`
      : resultContext?.search?.solverStatus === 'fallback'
        ? ` The full-pool solver was unavailable, so the deterministic ${resultContext.search.searchedPlayerCount}-player fallback was used; this is not a guaranteed league-wide optimum.`
        : resultContext?.search && !resultContext.search.exhausted
          ? ` This bounded search evaluated ${resultContext.search.searchedPlayerCount} of ${resultContext.search.eligiblePlayerCount} eligible players; the result is the best found within that shortlist, not a guaranteed league-wide optimum.`
          : resultContext?.search?.optimalityGuaranteed
            ? ' The eligible pool was fully exhausted.'
            : '';

  return (
    <section className="analysis-card analysis-results" aria-labelledby="analysis-title">
      <div className="analysis-header">
        <div>
          <div className="eyebrow">
            {mode === 'generation'
              ? 'Best valid lineup'
              : mode === 'repair'
                ? 'Repaired lineup'
                : 'Lineup analysis'}
          </div>
          <h2 id="analysis-title" ref={resultHeadingRef} tabIndex={-1}>
            {mode === 'generation'
              ? 'The strongest fit for your intent.'
              : mode === 'repair'
                ? 'The smallest change that works.'
                : 'How this five fits together.'}
          </h2>
        </div>
        <span className="verified-pill">
          <span aria-hidden="true">✓</span> Valid five
        </span>
      </div>

      {onBackToEditing || onRepair || onCompare ? (
        <div className="result-actions" aria-label="Result actions">
          {onBackToEditing ? (
            <button
              className="result-action result-action--back"
              type="button"
              onClick={onBackToEditing}
            >
              <span aria-hidden="true">←</span> Back to editing
            </button>
          ) : null}
          <div>
            {onRepair ? (
              <button className="result-action" type="button" onClick={onRepair}>
                Repair this lineup
              </button>
            ) : null}
            {onCompare ? (
              <button className="result-action" type="button" onClick={onCompare}>
                Compare versions
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <SelectedFive roster={roster} selectedPlayerIds={analysis.lineup.playerIds} />

      {versionSave ? (
        <SessionVersionSave suggestedName={versionSave.suggestedName} onSave={versionSave.onSave} />
      ) : null}

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

      {resultContext && (
        <div className="generation-summary">
          <div>
            <span>Weighted fit</span>
            <strong>{resultContext.objectiveScore}</strong>
          </div>
          <p>
            {resultContext.search?.strategy === 'cp-sat'
              ? mode === 'repair'
                ? 'Fewest swaps took priority over weighted fit across the full eligible pool.'
                : 'Optimized weighted fit across the full eligible pool.'
              : mode === 'repair'
                ? `Selected from ${resultContext.validCandidateCount} valid lineups after checking ${resultContext.evaluatedCandidateCount} combinations; fewest swaps took priority over weighted fit.`
                : `Ranked first among ${resultContext.validCandidateCount} valid lineups after checking ${resultContext.evaluatedCandidateCount} combinations.`}
            {resultContext.usedBalancedDefault
              ? ' Balanced priorities were applied because every weight was zero.'
              : ''}
            {solverSummary}
          </p>
          <div className="constraint-list" aria-label="Requirement results">
            {resultContext.constraints.map((constraint) => (
              <div className="constraint-result" key={constraint.id}>
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{constraint.label}</strong>
                  <small>{constraint.description}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="metric-grid">
        {metricDefinitions.map(([key, label]) => (
          <MetricCard key={key} label={label} metric={analysis.analysis[key]} />
        ))}
      </div>
    </section>
  );
}
