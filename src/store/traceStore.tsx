import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { TraceLensV1Trace, TraceLensStep, RunComparisonResult } from '../types/trace';
import { loadStoredRuns, saveRun, saveRuns, deleteRun, resetToDemoRuns, downloadJsonFile } from '../lib/storage';
import { computeRunComparison } from '../lib/analytics';

export type StudioTab = 'dashboard' | 'explorer' | 'workflow' | 'comparison' | 'analytics';
export type StatusFilter = 'all' | 'success' | 'failed';

interface TraceStoreContextType {
  runs: TraceLensV1Trace[];
  activeRun: TraceLensV1Trace | null;
  activeStep: TraceLensStep | null;
  comparisonRun: TraceLensV1Trace | null;
  comparisonResult: RunComparisonResult | null;
  activeTab: StudioTab;
  searchTerm: string;
  statusFilter: StatusFilter;
  isImportModalOpen: boolean;
  storageError: string;
  
  // Actions
  setActiveTab: (tab: StudioTab) => void;
  selectRun: (runId: string) => void;
  selectStep: (stepId: string | null) => void;
  setComparisonRunId: (runId: string | null) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setImportModalOpen: (open: boolean) => void;
  importTrace: (trace: TraceLensV1Trace) => void;
  importComparison: (baseline: TraceLensV1Trace, candidate: TraceLensV1Trace) => void;
  openComparisonEvidence: (runId: string, stepId: string) => void;
  restoreComparison: (() => void) | null;
  deleteRunById: (runId: string) => void;
  resetDemoDatasets: () => void;
  exportActiveRun: () => void;
  navigateStep: (direction: 'next' | 'prev') => void;
}

const TraceStoreContext = createContext<TraceStoreContextType | undefined>(undefined);

export function TraceStoreProvider({ children }: { children: ReactNode }) {
  const [runs, setRuns] = useState<TraceLensV1Trace[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [comparisonRunId, setComparisonRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [comparisonOrigin, setComparisonOrigin] = useState<{ baselineId: string; candidateId: string } | null>(null);

  // Load initial runs
  useEffect(() => {
    try {
    const loaded = loadStoredRuns();
    setRuns(loaded);
    if (loaded.length > 0) {
      setActiveRunId(loaded[0].runId);
      if (loaded[0].steps?.length > 0) {
        setActiveStepId(loaded[0].steps[0].stepId);
      }
      if (loaded.length > 1) {
        setComparisonRunId(loaded[1].runId);
      }
    }
    } catch (error) {
      setStorageError((error as Error).message);
    }
  }, []);

  const activeRun = useMemo(() => {
    return runs.find(r => r.runId === activeRunId) || (runs.length > 0 ? runs[0] : null);
  }, [runs, activeRunId]);

  const activeStep = useMemo(() => {
    if (!activeRun || !activeRun.steps) return null;
    return activeRun.steps.find(s => s.stepId === activeStepId) || (activeRun.steps.length > 0 ? activeRun.steps[0] : null);
  }, [activeRun, activeStepId]);

  const comparisonRun = useMemo(() => {
    if (!comparisonRunId) return null;
    return runs.find(r => r.runId === comparisonRunId) || null;
  }, [runs, comparisonRunId]);

  const comparisonResult = useMemo(() => {
    if (!activeRun || !comparisonRun) return null;
    return computeRunComparison(activeRun, comparisonRun);
  }, [activeRun, comparisonRun]);

  const selectRun = (runId: string) => {
    setActiveRunId(runId);
    const target = runs.find(r => r.runId === runId);
    if (target && target.steps && target.steps.length > 0) {
      setActiveStepId(target.steps[0].stepId);
    } else {
      setActiveStepId(null);
    }
  };

  const selectStep = (stepId: string | null) => {
    setActiveStepId(stepId);
  };

  const importTrace = (trace: TraceLensV1Trace) => {
    const updated = saveRun(trace);
    setStorageError('');
    setRuns(updated);
    setActiveRunId(trace.runId);
    if (trace.steps && trace.steps.length > 0) {
      setActiveStepId(trace.steps[0].stepId);
    }
    setActiveTab('explorer');
    setImportModalOpen(false);
  };

  const importComparison = (baseline: TraceLensV1Trace, candidate: TraceLensV1Trace) => {
    const updated = saveRuns([baseline, candidate]);
    setStorageError(''); setRuns(updated); setActiveRunId(baseline.runId);
    setActiveStepId(baseline.steps[0]?.stepId ?? null);
    setComparisonRunId(candidate.runId); setActiveTab('comparison'); setImportModalOpen(false);
  };

  const openComparisonEvidence = (runId: string, stepId: string) => {
    if (!activeRun || !comparisonRun) return;
    setComparisonOrigin({ baselineId: activeRun.runId, candidateId: comparisonRun.runId });
    selectRun(runId); selectStep(stepId); setActiveTab('explorer');
  };
  const restoreComparison = comparisonOrigin && runs.some(r => r.runId === comparisonOrigin.baselineId) && runs.some(r => r.runId === comparisonOrigin.candidateId) ? () => {
    selectRun(comparisonOrigin.baselineId); setComparisonRunId(comparisonOrigin.candidateId);
    setActiveTab('comparison'); setComparisonOrigin(null);
  } : null;

  const deleteRunById = (runId: string) => {
    try {
    const updated = deleteRun(runId);
    setStorageError('');
    setRuns(updated);
    if (activeRunId === runId) {
      if (updated.length > 0) {
        setActiveRunId(updated[0].runId);
        setActiveStepId(updated[0].steps?.[0]?.stepId || null);
      } else {
        setActiveRunId(null);
        setActiveStepId(null);
      }
    }
    if (comparisonRunId === runId) {
      setComparisonRunId(null);
    }
    } catch (error) { setStorageError((error as Error).message); }
  };

  const resetDemoDatasets = () => {
    try {
    const demos = resetToDemoRuns();
    setStorageError('');
    setRuns(demos);
    if (demos.length > 0) {
      setActiveRunId(demos[0].runId);
      setActiveStepId(demos[0].steps?.[0]?.stepId || null);
      if (demos.length > 1) {
        setComparisonRunId(demos[1].runId);
      }
    }
    } catch (error) { setStorageError((error as Error).message); }
  };

  const exportActiveRun = () => {
    if (!activeRun) return;
    const filename = `${activeRun.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_trace.json`;
    downloadJsonFile(filename, activeRun);
  };

  const navigateStep = (direction: 'next' | 'prev') => {
    if (!activeRun || !activeRun.steps || activeRun.steps.length === 0) return;
    const currentIndex = activeRun.steps.findIndex(s => s.stepId === activeStepId);
    if (currentIndex === -1) {
      setActiveStepId(activeRun.steps[0].stepId);
      return;
    }

    if (direction === 'next' && currentIndex < activeRun.steps.length - 1) {
      setActiveStepId(activeRun.steps[currentIndex + 1].stepId);
    } else if (direction === 'prev' && currentIndex > 0) {
      setActiveStepId(activeRun.steps[currentIndex - 1].stepId);
    }
  };

  return (
    <TraceStoreContext.Provider
      value={{
        runs,
        activeRun,
        activeStep,
        comparisonRun,
        comparisonResult,
        activeTab,
        searchTerm,
        statusFilter,
        isImportModalOpen,
        storageError,
        setActiveTab,
        selectRun,
        selectStep,
        setComparisonRunId,
        setSearchTerm,
        setStatusFilter,
        setImportModalOpen,
        importTrace,
        importComparison,
        openComparisonEvidence,
        restoreComparison,
        deleteRunById,
        resetDemoDatasets,
        exportActiveRun,
        navigateStep
      }}
    >
      {children}
    </TraceStoreContext.Provider>
  );
}

export function useTraceStore(): TraceStoreContextType {
  const context = useContext(TraceStoreContext);
  if (!context) {
    throw new Error('useTraceStore must be used within a TraceStoreProvider');
  }
  return context;
}
