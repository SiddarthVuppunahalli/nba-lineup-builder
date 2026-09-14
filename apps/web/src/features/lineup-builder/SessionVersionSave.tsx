import { useState } from 'react';

interface SessionVersionSaveProps {
  suggestedName: string;
  onSave: (name: string) => void;
}

export function SessionVersionSave({ suggestedName, onSave }: SessionVersionSaveProps) {
  const [name, setName] = useState(suggestedName);
  const [saved, setSaved] = useState(false);

  return (
    <div className="session-save">
      <div>
        <strong>Keep this version</strong>
        <p className="session-save-note">
          Saved in this browser tab until you refresh or close it.
        </p>
      </div>
      <label>
        <span className="sr-only">Version name</span>
        <input
          value={name}
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
        />
      </label>
      <button
        className="intent-button"
        type="button"
        disabled={saved || name.trim().length === 0}
        onClick={() => {
          onSave(name.trim());
          setSaved(true);
        }}
      >
        {saved ? 'Saved ✓' : 'Save version'}
      </button>
    </div>
  );
}
