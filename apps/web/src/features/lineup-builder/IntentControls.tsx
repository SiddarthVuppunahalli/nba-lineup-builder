import type { LineupIntentDto, RosterPlayerDto } from '@lineup-engine/shared';
import { useState } from 'react';
import type { UseFormRegister } from 'react-hook-form';

import { intentMetrics } from './intent-config.ts';

interface IntentControlsProps {
  roster: RosterPlayerDto[];
  register: UseFormRegister<LineupIntentDto>;
  requiredPlayerIds: readonly string[];
  excludedPlayerIds: readonly string[];
  onTogglePlayer: (field: 'requiredPlayerIds' | 'excludedPlayerIds', playerId: string) => void;
  showPlayerRules?: boolean;
}

export function IntentControls({
  roster,
  register,
  requiredPlayerIds,
  excludedPlayerIds,
  onTogglePlayer,
  showPlayerRules = true,
}: IntentControlsProps) {
  const [playerQuery, setPlayerQuery] = useState('');
  const normalizedPlayerQuery = playerQuery.trim().toLowerCase();
  const visibleRoster =
    normalizedPlayerQuery.length >= 2
      ? roster
          .filter(
            (player) =>
              player.name.toLowerCase().includes(normalizedPlayerQuery) ||
              player.teamAbbreviation.toLowerCase().includes(normalizedPlayerQuery),
          )
          .slice(0, 8)
      : [];
  const selectedRules = [
    ...requiredPlayerIds.map((playerId) => ({ playerId, kind: 'required' as const })),
    ...excludedPlayerIds.map((playerId) => ({ playerId, kind: 'excluded' as const })),
  ];

  return (
    <div className="generation-form-body">
      <fieldset>
        <legend>Ranking priorities</legend>
        <p>Choose what matters most. Equal settings use the balanced ranking.</p>
        <div className="control-grid">
          {intentMetrics.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <select {...register(`priorities.${key}`, { valueAsNumber: true })}>
                <option value={0}>Ignore</option>
                <option value={0.5}>Helpful</option>
                <option value={1}>Important</option>
              </select>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Role requirements</legend>
        <p>These are hard rules. The engine will never loosen them.</p>
        <div className="control-grid control-grid--two">
          <label>
            <span>Minimum credible shooters</span>
            <select {...register('minimumShooters', { valueAsNumber: true })}>
              {[0, 1, 2, 3, 4, 5].map((count) => (
                <option value={count} key={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Minimum high-level creators</span>
            <select {...register('minimumCreators', { valueAsNumber: true })}>
              {[0, 1, 2, 3, 4, 5].map((count) => (
                <option value={count} key={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Minimum lineup scores</legend>
        <p>Optional floors use the same 0–100 scores shown in the analysis.</p>
        <div className="control-grid">
          {intentMetrics.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="No minimum"
                {...register(`metricMinimums.${key}`, {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {showPlayerRules && (
        <fieldset className="player-rules-fieldset">
          <legend>Player rules</legend>
          <p>Lock players into the result or keep them out.</p>
          <div className="player-rule-chips" aria-label="Selected player rules">
            {selectedRules.length === 0 ? (
              <span className="player-rule-chips__empty">No player-specific rules.</span>
            ) : (
              selectedRules.map(({ playerId, kind }) => {
                const player = roster.find((candidate) => candidate.id === playerId);
                const label = kind === 'required' ? 'Required' : 'Excluded';
                return (
                  <span
                    className={`player-rule-chip player-rule-chip--${kind}`}
                    key={`${kind}-${playerId}`}
                  >
                    <span>
                      <small>{label}</small>
                      <strong>{player?.name ?? playerId}</strong>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${kind === 'required' ? 'requirement' : 'exclusion'} for ${player?.name ?? playerId}`}
                      onClick={() =>
                        onTogglePlayer(
                          kind === 'required' ? 'requiredPlayerIds' : 'excludedPlayerIds',
                          playerId,
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                );
              })
            )}
          </div>
          <details className="player-rule-picker">
            <summary>
              Add player rule
              <span>
                {selectedRules.length > 0 ? `${selectedRules.length} selected` : 'Optional'}
              </span>
            </summary>
            <div className="player-rule-picker__body">
              <label className="player-search player-search--rules">
                <span>Find a player or team</span>
                <input
                  type="search"
                  value={playerQuery}
                  placeholder="Type at least 2 characters"
                  onChange={(event) => setPlayerQuery(event.target.value)}
                />
              </label>
              {normalizedPlayerQuery.length < 2 ? (
                <p className="player-rule-picker__hint">
                  Search to add a required or excluded player.
                </p>
              ) : (
                <div className="player-rules" aria-label="Player rule search results">
                  {visibleRoster.map((player) => {
                    const required = requiredPlayerIds.includes(player.id);
                    const excluded = excludedPlayerIds.includes(player.id);
                    return (
                      <div className="player-rule" key={player.id}>
                        <span>
                          <strong>{player.name}</strong>
                          <small>
                            {player.teamAbbreviation} · {player.position}
                          </small>
                        </span>
                        <button
                          type="button"
                          disabled={required || excluded || requiredPlayerIds.length >= 5}
                          onClick={() => onTogglePlayer('requiredPlayerIds', player.id)}
                        >
                          {required ? 'Required' : 'Require'}
                        </button>
                        <button
                          type="button"
                          disabled={required || excluded}
                          onClick={() => onTogglePlayer('excludedPlayerIds', player.id)}
                        >
                          {excluded ? 'Excluded' : 'Exclude'}
                        </button>
                      </div>
                    );
                  })}
                  {visibleRoster.length === 0 ? (
                    <p className="no-player-results">No players match that search.</p>
                  ) : null}
                </div>
              )}
            </div>
          </details>
        </fieldset>
      )}
    </div>
  );
}
