import { useState } from 'react';

interface SessionVersionSaveProps {
  suggestedName: string;
  durable: boolean;
  onSave: (name: string) => Promise<void>;
}

export function SessionVersionSave({ suggestedName, durable, onSave }: SessionVersionSaveProps) {
  const [name, setName] = useState(suggestedName);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  return (
    <div className="session-save">
      <div>
        <strong>Keep this version</strong>
        <p className="session-save-note">
          {durable
            ? 'Saved to PostgreSQL automatically and available when you return.'
            : 'Saved in this browser tab until you refresh or close it.'}
        </p>
      </div>
      <label>
        <span className="sr-only">Version name</span>
        <input
          value={name}
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
            setStatus('idle');
          }}
        />
      </label>
      <button
        className="intent-button"
        type="button"
        disabled={status === 'saving' || status === 'saved' || name.trim().length === 0}
        onClick={async () => {
          setStatus('saving');
          try {
            await onSave(name.trim());
            setStatus('saved');
          } catch {
            setStatus('error');
          }
        }}
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save version'}
      </button>
      {status === 'error' ? (
        <p className="persistence-error" role="alert">
          This version could not be saved. Please try again.
        </p>
      ) : null}
    </div>
  );
}
