export type CaptureCli = 'codex' | 'gemini' | 'claude' | 'agy';
export type CaptureShell = 'powershell' | 'bash';

export function buildCaptureCommand(cli: CaptureCli, shell: CaptureShell): string {
  const prompt = '"Reply exactly TELEMETRY_OK. Do not use tools or modify files."';
  const commands = {
    codex: `codex exec --json --skip-git-repo-check --sandbox read-only ${prompt}`,
    gemini: `gemini -p ${prompt} --output-format stream-json`,
    claude: `claude -p ${prompt} --output-format stream-json --verbose`,
    agy: `agy -p ${prompt} --output-format stream-json`,
  };
  const file = `${cli}-tracelens.jsonl`;
  return shell === 'powershell'
    ? `${commands[cli]} | Out-File -Encoding utf8 -NoClobber .\\${file}`
    : `(set -C; ${commands[cli]} > ${file})`;
}
