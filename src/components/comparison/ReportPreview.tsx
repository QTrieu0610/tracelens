import { useEffect, useRef, useState } from 'react';
import type { RunComparisonResult } from '../../types/trace';
import { buildComparisonReport } from '../../lib/comparisonReport';
import { downloadTextFile } from '../../lib/storage';

export function ReportPreview({ comparison, onClose }: { comparison: RunComparisonResult; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [includeRunNames, setIncludeRunNames] = useState(false);
  const [text, setText] = useState(() => buildComparisonReport(comparison));
  const [feedback, setFeedback] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback('Markdown copied.');
    } catch {
      setFeedback('Clipboard unavailable. Download the Markdown or select and copy the preview text.');
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="report-title" className="w-[min(56rem,95vw)] max-h-[90vh] rounded-xl border border-studio-700 bg-studio-950 p-5 text-studio-100 backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="report-title" className="font-semibold">Comparison Markdown preview</h2>
        <button onClick={() => dialog.current?.close()} className="px-3 py-2 border border-studio-700 rounded">Close preview</button>
      </div>
      <p className="text-xs text-studio-300 mb-3">Raw trace content is excluded by default. Review and redact the editable text before sharing. Copy and download use exactly this text.</p>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={includeRunNames} onChange={event => {
          setIncludeRunNames(event.target.checked);
          setText(buildComparisonReport(comparison, { includeRunNames: event.target.checked }));
          setFeedback('Preview regenerated; previous edits replaced.');
        }} />
        Include run names (may contain sensitive information; replaces preview edits)
      </label>
      <label htmlFor="report-markdown" className="block text-sm mb-1">Editable Markdown</label>
      <textarea id="report-markdown" value={text} onChange={event => setText(event.target.value)} className="w-full h-[45vh] bg-studio-900 border border-studio-700 rounded p-3 text-xs font-mono" />
      <div className="flex flex-wrap gap-3 mt-3">
        <button onClick={copy} className="px-3 py-2 border border-studio-700 rounded">Copy Markdown</button>
        <button onClick={() => downloadTextFile('tracelens-comparison.md', text, 'text/markdown')} className="px-3 py-2 bg-cyan-800 rounded">Download Markdown</button>
      </div>
      <p role="status" className="text-xs text-studio-300 mt-2">{feedback}</p>
    </dialog>
  );
}
