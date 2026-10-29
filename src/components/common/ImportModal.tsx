import React, { useEffect, useState, useRef } from 'react';
import { X, Upload, AlertCircle, FileJson, CheckCircle } from 'lucide-react';
import { useTraceStore } from '../../store/traceStore';
import { parseTraceImport } from '../../lib/importTrace';
import { ValidationIssue } from '../../types/trace';
import { buildCaptureCommand, CaptureCli, CaptureShell } from '../../lib/captureCommands';

export function ImportModal() {
  const { isImportModalOpen, setImportModalOpen, importTrace } = useTraceStore();
  const [jsonText, setJsonText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [captureCli, setCaptureCli] = useState<CaptureCli>('codex');
  const [captureShell, setCaptureShell] = useState<CaptureShell>('powershell');
  const [captureCopyStatus, setCaptureCopyStatus] = useState('');
  const captureCommand = buildCaptureCommand(captureCli, captureShell);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isImportModalOpen && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [isImportModalOpen]);

  if (!isImportModalOpen) return null;

  const handleProcessJsonString = (content: string, name: string) => {
    setFileName(name);
    try {
      const res = parseTraceImport(content, name);
      if (res.valid && res.trace) {
        setValidationErrors([]);
        importTrace(res.trace);
      } else {
        setValidationErrors(res.errors);
      }
    } catch {
      setValidationErrors([
        {
          path: '',
          message: 'Unable to save this trace in browser storage. Free browser storage or remove unused runs, then retry.',
          code: 'IMPORT_SAVE_ERROR'
        }
      ]);
    }
  };

  const readFile = (file: File) => {
    setFileName(file.name);
    if (file.size > 10 * 1024 * 1024) {
      setValidationErrors([{ path: '', message: 'File exceeds the 10 MB import limit.', code: 'FILE_TOO_LARGE' }]);
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setValidationErrors([{ path: '', message: 'Unable to read this file. Try selecting it again.', code: 'FILE_READ_ERROR' }]);
    reader.onabort = () => setValidationErrors([{ path: '', message: 'File reading was interrupted.', code: 'FILE_READ_ERROR' }]);
    reader.onload = () => {
      try {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8';
        const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
        setJsonText(text);
        handleProcessJsonString(text, file.name);
      } catch {
        setValidationErrors([{ path: '', message: 'Invalid text encoding. Use UTF-8 or UTF-16LE with a BOM.', code: 'FILE_ENCODING_ERROR' }]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleManualImport = () => {
    if (!jsonText.trim()) return;
    handleProcessJsonString(jsonText, 'manual-input.json');
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="import-title" onCancel={() => setImportModalOpen(false)} className="w-[95vw] max-w-2xl max-h-[90vh] overflow-auto bg-transparent p-0 text-studio-100 backdrop:bg-black/70">
      <div className="w-full max-w-2xl bg-studio-900 border border-studio-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-studio-800 bg-studio-950">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-cyan-400" />
            <h2 id="import-title" className="text-base font-semibold text-studio-100">Import TraceLens JSON or CLI logs</h2>
          </div>
          <button
            aria-label="Close import"
            onClick={() => setImportModalOpen(false)}
            className="p-1 rounded-md text-studio-400 hover:text-studio-100 hover:bg-studio-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <details className="rounded-lg border border-studio-700 p-3 text-xs text-studio-300">
            <summary className="cursor-pointer font-medium text-cyan-300">Need a log? Show capture commands</summary>
            <div className="mt-3 space-y-3">
              <p>Run this in a terminal where your CLI is already authenticated. This starts a small CLI run using your account's allowance. TraceLens itself makes no model calls.</p>
              <div className="flex flex-wrap gap-3">
                <label>CLI format <select aria-label="CLI format" value={captureCli} onChange={e => { setCaptureCli(e.target.value as CaptureCli); setCaptureCopyStatus(''); }} className="ml-2 rounded border border-studio-700 bg-studio-950 p-1">
                  <option value="codex">Codex</option><option value="agy">Antigravity (AGY)</option><option value="gemini">Gemini CLI</option><option value="claude">Claude Code</option>
                </select></label>
                <label>Terminal shell <select aria-label="Terminal shell" value={captureShell} onChange={e => { setCaptureShell(e.target.value as CaptureShell); setCaptureCopyStatus(''); }} className="ml-2 rounded border border-studio-700 bg-studio-950 p-1">
                  <option value="powershell">PowerShell</option><option value="bash">Bash / zsh</option>
                </select></label>
              </div>
              <pre className="overflow-x-auto rounded bg-studio-950 p-3 text-studio-100"><code>{captureCommand}</code></pre>
              <button className="rounded border border-studio-600 px-3 py-2 hover:bg-studio-800" onClick={async () => {
                try { await navigator.clipboard.writeText(captureCommand); setCaptureCopyStatus('Command copied.'); }
                catch { setCaptureCopyStatus('Select the command above and copy it manually.'); }
              }}>Copy capture command</button>
              {captureCopyStatus && <p role="status">{captureCopyStatus}</p>}
              <p>After it finishes, import <strong>{captureCli}-tracelens.jsonl</strong> below. Existing files are protected from overwrite; choose a new filename for another capture. Save only stdout, without mixing in stderr or other sessions.</p>
            </div>
          </details>
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose trace file"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/20'
                : 'border-studio-800 hover:border-studio-700 bg-studio-950/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.jsonl,application/json,application/jsonl"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="p-3 rounded-full bg-studio-800/60 text-cyan-400">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-studio-200">
                {fileName ? `Selected: ${fileName}` : 'Drop JSON or JSONL here, or click to browse'}
              </p>
              <p className="text-xs text-studio-400">
                Codex exec, AGY, Claude Code or Gemini CLI structured logs, or TraceLens JSON. Up to 10 MB. Processing stays in this browser.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="trace-import-content" className="text-xs font-medium text-studio-400">Or paste JSON / JSONL content</label>
            <textarea
              id="trace-import-content"
              data-testid="import-json-textarea"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{\n  "schemaVersion": "tracelens-v1",\n  "runId": "...",\n  "steps": [...]\n}'
              rows={6}
              className="w-full p-3 font-mono text-xs bg-studio-950 border border-studio-800 rounded-lg text-studio-200 placeholder:text-studio-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {validationErrors.length > 0 && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-rose-400 font-medium text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Validation Failed ({validationErrors.length} errors)</span>
              </div>
              <ul className="text-xs text-rose-300/90 pl-6 list-disc space-y-0.5 max-h-32 overflow-auto font-mono">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>
                    {err.path ? <strong className="text-rose-200">{err.path}: </strong> : null}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-3.5 bg-studio-950 border-t border-studio-800">
          <button
            onClick={() => setImportModalOpen(false)}
            className="px-4 py-2 text-xs font-medium text-studio-400 hover:text-studio-200 transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="validate-import-btn"
            onClick={handleManualImport}
            disabled={!jsonText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-lg transition-colors shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Validate & Import</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
