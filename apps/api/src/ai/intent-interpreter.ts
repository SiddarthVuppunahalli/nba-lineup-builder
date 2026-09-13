import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const prioritySchema = z.union([z.literal(0), z.literal(0.5), z.literal(1)]);
const nullableMinimumSchema = z.number().int().min(0).max(100).nullable();

export const providerIntentInterpretationSchema = z.object({
  status: z.enum(['ready', 'needs_clarification']),
  intent: z.object({
    priorities: z.object({
      shooting: prioritySchema,
      creation: prioritySchema,
      playmaking: prioritySchema,
      rebounding: prioritySchema,
      perimeterDefense: prioritySchema,
      interiorDefense: prioritySchema,
      switchability: prioritySchema,
    }),
    minimumShooters: z.number().int().min(0).max(5),
    minimumCreators: z.number().int().min(0).max(5),
    metricMinimums: z.object({
      shooting: nullableMinimumSchema,
      creation: nullableMinimumSchema,
      playmaking: nullableMinimumSchema,
      rebounding: nullableMinimumSchema,
      perimeterDefense: nullableMinimumSchema,
      interiorDefense: nullableMinimumSchema,
      switchability: nullableMinimumSchema,
    }),
    requiredPlayerIds: z.array(z.string()),
    excludedPlayerIds: z.array(z.string()),
  }),
  summary: z.string().min(1),
  assumptions: z.array(z.string().min(1)).max(10),
  questions: z.array(z.string().min(1)).max(5),
});

export interface IntentInterpreterInput {
  text: string;
  players: Array<{ id: string; name: string; position: string }>;
}

export interface NaturalLanguageIntentInterpreter {
  readonly provider: string;
  readonly model: string;
  interpret(input: IntentInterpreterInput): Promise<unknown>;
}

const instructions = `You translate a basketball lineup request into the application's supported structured intent. You do not select or rank players.

Return only the requested structured output. Use these rules:
- Priorities are soft preferences. Use 1 for explicitly important metrics, 0.5 for secondary metrics, and 0 only when the user explicitly says to ignore one. Unmentioned priorities remain 1 for the balanced default.
- minimumShooters defaults to 3 and minimumCreators defaults to 1. Change a count only when the user clearly requests it.
- Metric minimums are hard 0-100 lineup score floors. Use null unless the user states a supported numeric floor.
- Required and excluded players are hard rules. Use only exact IDs from the supplied roster.
- Supported concepts are shooting, creation, playmaking, rebounding, perimeter defense, interior defense, switchability, shooter/creator counts, and required/excluded roster players.
- Do not invent meanings for unsupported concepts such as small-ball, switching specific positions, pace, chemistry, salary, trades, or matchup predictions.
- Use needs_clarification when the request is materially ambiguous, names an unknown player, or relies on an unsupported concept. Preserve a conservative editable draft, explain assumptions, and ask concise questions.
- Use ready only when the request maps unambiguously to supported fields. For ready, questions must be empty.
- Summarize the interpretation in plain language without claiming that a valid lineup exists.`;

export class OpenAiIntentInterpreter implements NaturalLanguageIntentInterpreter {
  readonly provider = 'openai';
  readonly model: string;
  private readonly client: OpenAI;

  constructor(options: { apiKey: string; model: string }) {
    this.model = options.model;
    this.client = new OpenAI({ apiKey: options.apiKey, timeout: 15_000, maxRetries: 1 });
  }

  async interpret(input: IntentInterpreterInput): Promise<unknown> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      reasoning: { effort: 'low' },
      instructions,
      input: JSON.stringify({ request: input.text, eligibleRoster: input.players }),
      text: {
        format: zodTextFormat(providerIntentInterpretationSchema, 'lineup_intent_interpretation'),
      },
    });

    if (!response.output_parsed) {
      throw new Error('The intent provider returned no structured output.');
    }

    return response.output_parsed;
  }
}
