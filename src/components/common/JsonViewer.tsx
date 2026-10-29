import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  maxHeight?: string;
  title?: string;
}

export function JsonViewer({ data, maxHeight = 'max-h-96', title }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const formatted = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const handleCopy = async () => {
    setCopied(false);
    setCopyError('');
    try {
      await navigator.clipboard.writeText(formatted ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Clipboard unavailable. Select the payload below and copy it manually.');
    }
  };

  return (
    <div className="relative rounded-lg border border-studio-800 bg-studio-950 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-studio-900 border-b border-studio-800 text-studio-400">
        <span className="text-[11px] font-medium tracking-wide uppercase">{title || 'JSON Payload'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:text-studio-100 hover:bg-studio-800 transition-colors"
          title="Copy JSON to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {copyError && <p role="status" className="px-3 py-2 text-amber-300">{copyError}</p>}
      <pre className={`p-3 overflow-auto ${maxHeight} text-studio-200 leading-relaxed`}>
        <code>{formatted}</code>
      </pre>
    </div>
  );
}
