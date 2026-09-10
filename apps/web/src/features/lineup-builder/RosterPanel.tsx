import type { RosterPlayerDto } from '@lineup-engine/shared';

interface RosterPanelProps {
  players: RosterPlayerDto[];
  selectedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
}

const profileHighlights = [
  ['shooting', 'SHT'],
  ['creation', 'CRE'],
  ['perimeterDefense', 'PDEF'],
  ['rebounding', 'REB'],
] as const;

export function RosterPanel({ players, selectedPlayerIds, onTogglePlayer }: RosterPanelProps) {
  const selectionFull = selectedPlayerIds.length === 5;

  return (
    <div className="roster-list" aria-label="Team roster">
      {players.map((player) => {
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
              <span>{player.position}</span>
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
    </div>
  );
}
