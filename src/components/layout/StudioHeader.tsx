import React from 'react';
import { 
  Activity, 
  GitCompare, 
  Workflow, 
  BarChart3, 
  LayoutDashboard, 
  Upload, 
  Download, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useTraceStore, StudioTab } from '../../store/traceStore';
import { getRunStatusLabel } from '../../lib/runEvidence';

export function StudioHeader() {
  const resetDialog = React.useRef<HTMLDialogElement>(null);
  const {
    runs,
    activeRun,
    activeTab,
    setActiveTab,
    selectRun,
    setImportModalOpen,
    exportActiveRun,
    resetDemoDatasets
  } = useTraceStore();

  const navItems: Array<{ id: StudioTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'explorer', label: 'Trace Explorer', icon: <Activity className="w-4 h-4" /> },
    { id: 'workflow', label: 'Workflow Graph', icon: <Workflow className="w-4 h-4" /> },
    { id: 'comparison', label: 'Run Comparison', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'analytics', label: 'Studio Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-studio-800 bg-studio-950/90 backdrop-blur-md">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        {/* Brand & Active Run Selector */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div 
            onClick={() => setActiveTab('dashboard')} 
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span data-testid="studio-title" className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                TraceLens
                <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.2 text-cyan-400 bg-cyan-950/80 border border-cyan-800 rounded">v1.0</span>
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-studio-800" />

          {/* Run Switcher Dropdown */}
          {runs.length > 0 && activeRun && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Select execution run"
                value={activeRun.runId}
                onChange={(e) => selectRun(e.target.value)}
                className="px-2.5 py-1 text-xs bg-studio-900 border border-studio-800 rounded-lg text-studio-200 focus:outline-none focus:border-cyan-500 max-w-[80px] sm:max-w-[240px] truncate cursor-pointer"
              >
                {runs.map((r) => (
                  <option key={r.runId} value={r.runId} className="bg-studio-900 text-studio-100">
                    {r.name} — {getRunStatusLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-studio-900/80 p-1 rounded-lg border border-studio-800">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-studio-800 text-cyan-400 shadow-sm'
                    : 'text-studio-400 hover:text-studio-200 hover:bg-studio-850/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            data-testid="open-import-modal-btn"
            onClick={() => setImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors shadow-sm"
            title="Import CLI logs or TraceLens JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            onClick={exportActiveRun}
            disabled={!activeRun}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-studio-300 hover:text-white bg-studio-900 hover:bg-studio-800 border border-studio-800 rounded-lg transition-colors disabled:opacity-50"
            title="Download full trace JSON (includes raw inputs and outputs; not sanitized)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={() => resetDialog.current?.showModal()}
            className="p-1.5 text-studio-400 hover:text-studio-200 bg-studio-900 hover:bg-studio-800 border border-studio-800 rounded-lg transition-colors"
            title="Reset to default synthetic demo datasets"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <dialog ref={resetDialog} aria-labelledby="reset-title" className="max-w-sm w-[90vw] rounded-xl border border-studio-700 bg-studio-900 text-studio-100 p-6 backdrop:bg-black/70">
        <h2 id="reset-title" className="font-semibold">Replace stored runs with demos?</h2>
        <p className="mt-2 text-sm text-studio-300">This removes your imported runs from this browser. Export any traces you want to keep first.</p>
        <div className="mt-4 flex justify-end gap-4">
          <button onClick={() => resetDialog.current?.close()}>Cancel</button>
          <button onClick={() => { resetDemoDatasets(); resetDialog.current?.close(); }} className="rounded bg-rose-700 px-3 py-2">Replace stored runs</button>
        </div>
      </dialog>

      {/* Mobile nav bar */}
      <div className="flex md:hidden overflow-x-auto border-t border-studio-850 px-2 py-1.5 gap-1 bg-studio-950">
        {navItems.map((item) => (
          <button
            key={item.id}
            data-testid={`mobile-nav-tab-${item.id}`}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
              activeTab === item.id
                ? 'bg-studio-800 text-cyan-400'
                : 'text-studio-400 hover:text-studio-200'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
