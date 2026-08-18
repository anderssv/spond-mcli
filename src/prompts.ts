export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: { name: string; description: string; required?: boolean }[];
}

export interface PromptResult {
  description: string;
  messages: { role: 'user' | 'assistant'; content: { type: 'text'; text: string } }[];
}

const PROMPTS: PromptDefinition[] = [
  {
    name: 'upcoming_events_for_group',
    description: 'Find upcoming events for a specific group, projected to a compact shape instead of ingesting full event records',
    arguments: [
      { name: 'groupName', description: 'Name (or partial name) of the group', required: true }
    ]
  }
];

export function getPromptDefinitions(): PromptDefinition[] {
  return PROMPTS;
}

export function getPrompt(name: string, args: Record<string, string> = {}): PromptResult {
  if (name === 'upcoming_events_for_group') {
    const groupName = args.groupName ?? '<groupName>';
    return {
      description: 'Find upcoming events for a specific group, compact',
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Call get_events with groupName="${groupName}" and query="[?registrationStatus=='open'].{heading: heading, startTime: startTime, registrationStatus: registrationStatus}" to get a compact list of that group's events open for registration, projected server-side instead of ingesting every field of every event.`
          }
        }
      ]
    };
  }

  throw new Error(`Unknown prompt: ${name}`);
}
