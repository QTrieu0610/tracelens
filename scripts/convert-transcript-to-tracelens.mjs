import { readFileSync, writeFileSync } from 'node:fs';

export function convertTranscriptToTraceLens(transcriptPath, options = {}) {
  const lines = readFileSync(transcriptPath, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  const rawEntries = lines.map(line => JSON.parse(line));

  const steps = [];
  let stepCounter = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    const timestamp = entry.created_at || new Date().toISOString();

    if (entry.input_tokens) totalPromptTokens += entry.input_tokens;
    if (entry.output_tokens) totalCompletionTokens += entry.output_tokens;

    if (entry.type === 'USER_INPUT') {
      steps.push({
        stepId: `step-${stepCounter++}`,
        stepIndex: steps.length,
        type: 'user_input',
        name: 'User request',
        status: 'success',
        startedAt: timestamp,
        completedAt: timestamp,
        durationMs: 50,
        input: entry.content || '',
      });
      continue;
    }

    if (entry.type === 'PLANNER_RESPONSE') {
      // If there is thinking
      if (entry.thinking) {
        steps.push({
          stepId: `step-${stepCounter++}`,
          stepIndex: steps.length,
          type: 'agent_thought',
          name: 'Agent reasoning',
          status: 'success',
          startedAt: timestamp,
          completedAt: timestamp,
          durationMs: 200,
          thought: entry.thinking,
          tokens: entry.output_tokens ? {
            promptTokens: entry.input_tokens || 0,
            completionTokens: entry.output_tokens || 0,
            totalTokens: (entry.input_tokens || 0) + (entry.output_tokens || 0),
          } : undefined,
        });
      }

      // If there are tool calls
      if (entry.tool_calls && Array.isArray(entry.tool_calls)) {
        for (const tc of entry.tool_calls) {
          // Look ahead to find the corresponding tool result
          let toolResultContent = '';
          let isError = false;
          if (i + 1 < rawEntries.length && rawEntries[i + 1].type === 'GENERIC') {
            const resultEntry = rawEntries[i + 1];
            toolResultContent = resultEntry.content || '';
            if (resultEntry.status === 'ERROR' || /command exited with code [1-9]|syntaxerror|assertionerror/i.test(toolResultContent)) {
              isError = true;
            }
          }

          steps.push({
            stepId: `step-${stepCounter++}`,
            stepIndex: steps.length,
            type: 'tool_call',
            name: `${tc.name}: ${JSON.stringify(tc.args).slice(0, 50)}`,
            status: isError ? 'failed' : 'success',
            startedAt: timestamp,
            completedAt: timestamp,
            durationMs: 350,
            input: tc.args,
            output: toolResultContent,
            error: isError ? { message: toolResultContent.slice(0, 200) } : undefined,
          });
        }
      }

      // If it has final content (user-facing assistant text)
      if (entry.content && (!entry.tool_calls || entry.tool_calls.length === 0)) {
        steps.push({
          stepId: `step-${stepCounter++}`,
          stepIndex: steps.length,
          type: 'agent_thought',
          name: 'Agent final report',
          status: 'success',
          startedAt: timestamp,
          completedAt: timestamp,
          durationMs: 150,
          thought: entry.content,
          output: entry.content,
        });
      }
    }
  }

  const trace = {
    schemaVersion: 'tracelens-v1',
    runId: options.runId || `real-run-${Date.now()}`,
    name: options.name || 'Live Subagent Math Project Execution',
    description: options.description || 'Live autonomous execution by AGY Junior Developer Agent.',
    agentName: options.agentName || 'JuniorDeveloperAgent',
    model: options.model || 'gemini-3.8-flash',
    status: steps.some(s => s.status === 'failed') ? 'failed' : 'success',
    startedAt: steps[0]?.startedAt || new Date().toISOString(),
    completedAt: steps[steps.length - 1]?.completedAt || new Date().toISOString(),
    totalDurationMs: steps.reduce((sum, s) => sum + s.durationMs, 0),
    totalTokens: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
    },
    tags: ['live-run', 'subagent', 'real-world', 'honesty-audit'],
    metadata: {
      source: 'tracelens-json',
      liveSubagent: true,
      conversationId: options.conversationId,
    },
    steps,
  };

  return trace;
}

// CLI usage if run directly
if (process.argv[1]?.endsWith('convert-transcript-to-tracelens.mjs') && process.argv[2]) {
  const input = process.argv[2];
  const output = process.argv[3] || 'fixtures/real-subagent-run.json';
  const trace = convertTranscriptToTraceLens(input);
  writeFileSync(output, JSON.stringify(trace, null, 2), 'utf8');
  console.log(`Successfully converted ${input} to ${output}`);
}
