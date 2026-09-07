# Claude Code Handoff — Workplace English RPG Curriculum v1.0

Use curriculum.json, phrasePatterns.json, and learningModel.json.

Core behavior:
1. Player responses are always free-form. Never require exact target phrases.
2. Infer the player's intended meaning first.
3. Compare intent with actual expression.
4. If the player's English is already natural and context-appropriate, do not teach or create a learning item.
5. If there is a gap, prefer a minimal, contextual correction.
6. Track recurring gaps and mastery evidence.
7. Do not repeatedly teach expressions the player already demonstrates naturally.
8. Target expressions are guidance for AI conversation generation, not answer keys.

Implement data-driven lesson loading and keep curriculum content out of UI components.
Future AI responses should conform to the learningModel fields.
