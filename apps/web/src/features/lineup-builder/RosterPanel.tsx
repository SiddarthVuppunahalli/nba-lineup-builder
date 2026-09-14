import type { RosterPlayerDto } from '@lineup-engine/shared';
import { useState } from 'react';

interface RosterPanelProps {
  players: RosterPlayerDto[];
  selectedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  searchable?: boolean;
}

const profileHighlights = [
  ['shooting', 'SHT'],
  ['creation', 'CRE'],
  ['perimeterDefense', 'PDEF'],
  ['rebounding', 'REB'],
] as const;

export function RosterPanel({
  players,
  selectedPlayerIds,
  onTogglePlayer,
  searchable = false,
}: RosterPanelProps) {
  const selectionFull = selectedPlayerIds.length === 5;
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePlayers = normalizedQuery
    ? players.filter(
        (player) =>
          player.name.toLowerCase().includes(normalizedQuery) ||
          player.teamAbbreviation.toLowerCase().includes(normalizedQuery),
      )
    : players;

  return (
    <>
      {searchable ? (
        <label className="player-search">
          <span>Find a player or team</span>
          <input
            type="search"
            value={query}
            placeholder="Try Curry or BOS"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      ) : null}
      <div className="roster-list" aria-label="Available players">
        {visiblePlayers.map((player) => {
          const selected = selectedPlayerIds.includes(player.id);
          const disabled = selectionFull && !selected;

          return (
            <button
              className={`player-card ${selected ? 'player-card--selected' : ''}`}
              type="button"
              key={player.id}
              onClick={() => onTogglePlayer(player.id)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${selected ? 'Remove' : 'Select'} ${player.name}`}
            >
              <span className="player-selection" aria-hidden="true">
                {selected ? '✓' : '+'}
              </span>
              <span className="player-identity">
                <strong>{player.name}</strong>
                <span>
                  {player.teamAbbreviation} · {player.position}
                </span>
              </span>
              <span className="player-profile" aria-hidden="true">
                {profileHighlights.map(([metric, abbreviation]) => (
                  <span key={metric}>
                    <small>{abbreviation}</small>
                    <strong>{player.profile[metric]}</strong>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
        {visiblePlayers.length === 0 ? (
          <p className="no-player-results">No players match that search.</p>
        ) : null}
      </div>
    </>
  );
}
