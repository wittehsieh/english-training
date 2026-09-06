import { ProgressPanel } from '../components/progress/ProgressPanel';

export function ProgressPage() {
  return (
    <div>
      <div className="page-head">
        <h1>Progress</h1>
        <p>Your XP, level, and how far you've gotten through each category.</p>
      </div>
      <ProgressPanel />
    </div>
  );
}
