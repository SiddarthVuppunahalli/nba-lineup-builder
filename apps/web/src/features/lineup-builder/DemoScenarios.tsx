export interface DemoScenarioSelection {
  workflow: 'manual' | 'generation' | 'repair';
  playerIds: string[];
  analyzeImmediately?: boolean;
}

interface DemoScenariosProps {
  onSelect: (selection: DemoScenarioSelection) => void;
}

const scenarios: Array<{
  kicker: string;
  title: string;
  description: string;
  action: string;
  selection: DemoScenarioSelection;
}> = [
  {
    kicker: 'Quick read',
    title: 'Meet a balanced five',
    description: 'Start with a versatile group and open its full fit analysis in one click.',
    action: 'Analyze balanced five',
    selection: {
      workflow: 'manual',
      playerIds: ['jordan-vega', 'malik-rhodes', 'eli-mercer', 'theo-grant', 'samir-cole'],
      analyzeImmediately: true,
    },
  },
  {
    kicker: 'Guided search',
    title: 'Find the best fit',
    description: 'Open the balanced intent preset, then tune priorities or requirements.',
    action: 'Open lineup search',
    selection: { workflow: 'generation', playerIds: [] },
  },
  {
    kicker: 'Tradeoff demo',
    title: 'Fix weak spacing',
    description: 'Load a defense-and-size-heavy five, then repair it for more shooting.',
    action: 'Load repair example',
    selection: {
      workflow: 'repair',
      playerIds: ['andre-okafor', 'darius-knox', 'owen-price', 'luca-hayes', 'theo-grant'],
    },
  },
];

export function DemoScenarios({ onSelect }: DemoScenariosProps) {
  return (
    <section className="demo-scenarios" aria-labelledby="demo-scenarios-title">
      <div className="demo-scenarios__intro">
        <span className="panel-kicker">Try a guided example</span>
        <h2 id="demo-scenarios-title">Jump straight into the lineup lab.</h2>
      </div>
      <div className="demo-scenarios__grid">
        {scenarios.map((scenario) => (
          <article className="demo-scenario" key={scenario.title}>
            <span>{scenario.kicker}</span>
            <h3>{scenario.title}</h3>
            <p>{scenario.description}</p>
            <button type="button" onClick={() => onSelect(scenario.selection)}>
              {scenario.action} <span aria-hidden="true">→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
