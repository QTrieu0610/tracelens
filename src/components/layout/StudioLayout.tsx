import { ReactNode } from 'react';
import { StudioHeader } from './StudioHeader';
import { ImportModal } from '../common/ImportModal';
import { useTraceStore } from '../../store/traceStore';
import { downloadTextFile } from '../../lib/storage';

export function StudioLayout({ children }: { children: ReactNode }) {
  const { storageError } = useTraceStore();
  const downloadBackup = () => {
    try {
      const raw = localStorage.getItem('tracelens_runs_v1');
      if (raw !== null) downloadTextFile('tracelens-storage-backup.json', raw, 'application/json');
    } catch { window.alert('Browser storage cannot be read. Enable storage access and try again.'); }
  };
  return (
    <div className="min-h-screen flex flex-col bg-studio-950 text-studio-100 font-sans">
      <StudioHeader />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {storageError && <div role="alert" className="mb-4 rounded-xl border border-rose-800 bg-rose-950/30 p-4 text-sm text-rose-200 space-y-2">
          <p>{storageError}</p>
          <button onClick={downloadBackup} className="underline">Download stored data backup</button>
          <p className="text-xs">The backup contains raw traces; review it before sharing. Reset is available in the header.</p>
        </div>}
        {children}
      </main>
      <ImportModal />
    </div>
  );
}
