import type { LineupIntentDto } from '@lineup-engine/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ApiClientError,
  fetchIntentInterpreterStatus,
  postIntentInterpretation,
} from '../../api/client.ts';

interface NaturalLanguageIntentProps {
  teamId: string;
  onApply: (intent: LineupIntentDto) => void;
}

function errorMessage(error: Error | null): string {
  if (error instanceof ApiClientError) return error.message;
  return 'Natural-language interpretation is temporarily unavailable.';
}

export function NaturalLanguageIntent({ teamId, onApply }: NaturalLanguageIntentProps) {
  const [text, setText] = useState('');
  const [applied, setApplied] = useState(false);
  const status = useQuery({
    queryKey: ['intent-interpreter-status'],
    queryFn: fetchIntentInterpreterStatus,
    retry: false,
  });
  const interpretation = useMutation({ mutationFn: postIntentInterpretation });
  const available = status.data?.available === true;

  function interpret() {
    const request = text.trim();
    if (!available || request.length < 3) return;
    setApplied(false);
    interpretation.mutate({ teamId, text: request });
  }

  function applyInterpretation() {
    if (!interpretation.data) return;
    onApply(interpretation.data.intent);
    setApplied(true);
  }

  return (
    <section className="natural-intent" aria-labelledby="natural-intent-title">
      <div>
        <span className="panel-kicker">Optional AI assist</span>
        <h3 id="natural-intent-title">Describe the lineup you want</h3>
        <p>We’ll translate your words into the same settings below. You review every choice.</p>
      </div>
      <label>
        <span>Lineup request</span>
        <textarea
          value={text}
          maxLength={500}
          rows={3}
          placeholder="For example: Prioritize shooting and perimeter defense, keep Theo, and use at least two creators."
          onChange={(event) => {
            setText(event.target.value);
            setApplied(false);
            interpretation.reset();
          }}
        />
      </label>
      {status.isPending ? (
        <p className="natural-intent__availability" role="status">
          Checking natural-language availability…
        </p>
      ) : !available ? (
        <p className="natural-intent__availability natural-intent__availability--notice">
          Natural-language help is unavailable. Every structured control below still works.
        </p>
      ) : null}
      <button
        className="intent-button"
        type="button"
        disabled={!available || interpretation.isPending || text.trim().length < 3}
        onClick={interpret}
      >
        {interpretation.isPending ? 'Interpreting…' : 'Interpret request'}
      </button>

      {interpretation.isError ? (
        <div className="natural-intent__message natural-intent__message--error" role="alert">
          <strong>We couldn’t interpret that request.</strong>
          <p>{errorMessage(interpretation.error)}</p>
          <p>You can keep using the structured controls below.</p>
        </div>
      ) : null}

      {interpretation.data ? (
        <div className="natural-intent__message" aria-live="polite">
          <span className="panel-kicker">
            {interpretation.data.status === 'ready' ? 'Ready to review' : 'Needs clarification'}
          </span>
          <h3>Review the interpretation</h3>
          <p>{interpretation.data.summary}</p>
          {interpretation.data.assumptions.length > 0 ? (
            <div>
              <strong>Assumptions</strong>
              <ul>
                {interpretation.data.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {interpretation.data.questions.length > 0 ? (
            <div className="natural-intent__questions">
              <strong>A little more detail would help</strong>
              <ul>
                {interpretation.data.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button className="intent-button" type="button" onClick={applyInterpretation}>
            {applied ? 'Settings applied ✓' : 'Use as a starting point'}
          </button>
          <small>Review and adjust the structured settings before generating.</small>
        </div>
      ) : null}
    </section>
  );
}
