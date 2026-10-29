import { useTraceStore } from './store/traceStore';
import { StudioLayout } from './components/layout/StudioLayout';
import { ExecutionTable } from './components/dashboard/ExecutionTable';
import { TimelineView } from './components/explorer/TimelineView';
import { WorkflowGraph } from './components/workflow/WorkflowGraph';
import { ComparisonView } from './components/comparison/ComparisonView';
import { AnalyticsView } from './components/dashboard/AnalyticsView';

export function App() {
  const { activeTab } = useTraceStore();

  return (
    <StudioLayout>
      {activeTab === 'dashboard' && <ExecutionTable />}
      {activeTab === 'explorer' && <TimelineView />}
      {activeTab === 'workflow' && <WorkflowGraph />}
      {activeTab === 'comparison' && <ComparisonView />}
      {activeTab === 'analytics' && <AnalyticsView />}
    </StudioLayout>
  );
}

export default App;
