import { PhraseBook } from '../components/phrases/PhraseBook';

export function PhraseBookPage() {
  return (
    <div>
      <div className="page-head">
        <h1>Phrase Book</h1>
        <p>Expressions you used naturally in conversation are collected here.</p>
      </div>
      <PhraseBook />
    </div>
  );
}
