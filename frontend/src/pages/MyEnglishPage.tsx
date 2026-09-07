import { MyEnglishPanel } from '../components/learning/MyEnglishPanel';

export function MyEnglishPage() {
  return (
    <div>
      <div className="page-head">
        <h1>My English</h1>
        <p>
          Your Personal Language Gaps — the expressions you reached for but
          didn’t quite have yet, and how close you are to owning them.
        </p>
      </div>
      <MyEnglishPanel />
    </div>
  );
}
