import { ProgressPanel } from '../components/progress/ProgressPanel';

export function ProgressPage() {
  return (
    <div>
      <div className="page-head">
        <h1>Progress</h1>
        <p>Your story progress, and how your English is actually developing.</p>
      </div>
      <ProgressPanel />
    </div>
  );
}
