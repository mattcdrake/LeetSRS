import { ViewLayout } from '../../components/ViewLayout';
import { DebugPanel } from '../../debug/DebugPanel';

export function DebugView() {
  return (
    <ViewLayout>
      <div>
        <h2 className="text-xl font-bold mb-4 text-primary">Debug Information</h2>
        <DebugPanel />
      </div>
    </ViewLayout>
  );
}
