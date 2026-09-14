import type { LineupIntentDto, RosterPlayerDto } from '@lineup-engine/shared';
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
        <fieldset>
          <legend>Player rules</legend>
          <p>Lock players into the result or keep them out.</p>
          <div className="player-rules" aria-label="Required and excluded players">
            {roster.map((player) => {
              const required = requiredPlayerIds.includes(player.id);
              const excluded = excludedPlayerIds.includes(player.id);
              return (
                <div className="player-rule" key={player.id}>
                  <span>
                    <strong>{player.name}</strong>
                    <small>{player.position}</small>
                  </span>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Require ${player.name}`}
                      checked={required}
                      disabled={excluded}
                      onChange={() => onTogglePlayer('requiredPlayerIds', player.id)}
                    />
                    Require
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Exclude ${player.name}`}
                      checked={excluded}
                      disabled={required}
                      onChange={() => onTogglePlayer('excludedPlayerIds', player.id)}
                    />
                    Exclude
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
