import { Fragment } from "react";
import TajweedText from "@/components/TajweedText";
import { splitAyahWords } from "@/lib/word-root";

interface WordTapTextProps {
  surahNumber: number;
  ayahNumber: number;
  /** Displayed ayah text (Basmala already split off where applicable). */
  text: string;
  /** Offset of `text` start inside the full ayah text (TajweedText window base). */
  windowBase: number;
  tajweed: boolean;
  onRuleClick?: (rule: string) => void;
  /** When undefined, words are not tappable (e.g. memorisation blur). */
  onWordClick?: (wordIndex: number, wordText: string) => void;
}

// Ayah text rendered word by word so any word can be tapped for its
// root / meaning sheet (1.0.74), while tajweed colours and rule taps
// keep working. Word indices match splitAyahWords() of the displayed
// text — the contract in src/lib/word-root.ts.
//
// Tap discrimination: the handler runs on capture. A tap whose target
// sits inside a coloured tajweed span is left alone — it bubbles to the
// rule span's own onClick (rule sheet). Any other tap on a word calls
// onWordClick and stops propagation, so the ayah's own onClick (play
// ayah) does not fire — the parent decides what the tap does (1.0.76:
// first tap plays the ayah, tapping the selected ayah opens the sheet).
export default function WordTapText({
  surahNumber,
  ayahNumber,
  text,
  windowBase,
  tajweed,
  onRuleClick,
  onWordClick,
}: WordTapTextProps) {
  const tokens = splitAyahWords(text);
  // Char offsets of each token, in the same order as splitAyahWords.
  const offsets: { start: number; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    offsets.push({ start: m.index, end: m.index + m[0].length });
  }
  // If tokenisation ever disagrees, fall back to plain text (no tap).
  if (offsets.length !== tokens.length) {
    return (
      <TajweedText
        surahNumber={surahNumber}
        ayahNumber={ayahNumber}
        text={text}
        enabled={tajweed}
        window={[windowBase, windowBase + text.length]}
        onRuleClick={onRuleClick}
      />
    );
  }

  let cursor = 0;
  return (
    <>
      {tokens.map((token, i) => {
        const { start, end } = offsets[i];
        const gap = text.slice(cursor, start);
        cursor = end;
        const word = (
          <span
            key={i}
            onClickCapture={
              onWordClick
                ? (e) => {
                    const t = e.target as HTMLElement;
                    if (t.closest("[data-tajweed-rule]")) return;
                    e.stopPropagation();
                    onWordClick(i, token);
                  }
                : undefined
            }
          >
            <TajweedText
              surahNumber={surahNumber}
              ayahNumber={ayahNumber}
              text={token}
              enabled={tajweed}
              window={[windowBase + start, windowBase + end]}
              onRuleClick={onRuleClick}
            />
          </span>
        );
        return (
          <Fragment key={`w-${i}`}>
            {gap ? gap : null}
            {word}
          </Fragment>
        );
      })}
      {cursor < text.length ? text.slice(cursor) : null}
    </>
  );
}
