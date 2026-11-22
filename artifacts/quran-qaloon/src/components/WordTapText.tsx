import { Fragment, useMemo, useRef } from "react";
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
  /** [1.0.80] Long-press (≥550ms, no move) — e.g. reading mode opens
      the word sheet; the click that follows it is suppressed. */
  onWordLongPress?: (wordIndex: number, wordText: string) => void;
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
  onWordLongPress,
}: WordTapTextProps) {
  // [1.0.80] Long-press state (shared: only one press at a time).
  // `fired` is reset on the next pointerdown, so a stale flag can
  // never swallow a later tap.
  const longPressRef = useRef<{
    timer: number | null;
    x: number;
    y: number;
    fired: boolean;
  }>({ timer: null, x: 0, y: 0, fired: false });
  const clearLongPressTimer = () => {
    if (longPressRef.current.timer != null) {
      window.clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  };
  // [1.0.104] التقطيع كان يُعاد عند كل رسم لكل آية — فصار محفوظًا:
  // لا يُعاد إلا حين يتغير نص الآية.
  const { tokens, offsets } = useMemo(() => {
    const t = splitAyahWords(text);
    const o: { start: number; end: number }[] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      o.push({ start: m.index, end: m.index + m[0].length });
    }
    return { tokens: t, offsets: o };
  }, [text]);
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
            className={onWordLongPress ? "select-none" : undefined}
            style={onWordLongPress ? { WebkitTouchCallout: "none" } : undefined}
            onPointerDown={
              onWordLongPress
                ? (e) => {
                    const t = e.target as HTMLElement;
                    // A coloured tajweed letter keeps its rule tap.
                    if (t.closest("[data-tajweed-rule]")) return;
                    longPressRef.current = { timer: null, x: e.clientX, y: e.clientY, fired: false };
                    longPressRef.current.timer = window.setTimeout(() => {
                      longPressRef.current.timer = null;
                      longPressRef.current.fired = true;
                      onWordLongPress(i, token);
                    }, 550);
                  }
                : undefined
            }
            onPointerMove={
              onWordLongPress
                ? (e) => {
                    const lp = longPressRef.current;
                    if (lp.timer == null) return;
                    if (Math.abs(e.clientX - lp.x) > 12 || Math.abs(e.clientY - lp.y) > 12) {
                      clearLongPressTimer();
                    }
                  }
                : undefined
            }
            onPointerUp={onWordLongPress ? clearLongPressTimer : undefined}
            onPointerCancel={onWordLongPress ? clearLongPressTimer : undefined}
            onClickCapture={
              onWordClick
                ? (e) => {
                    // The click after a long-press must not play audio.
                    if (longPressRef.current.fired) {
                      longPressRef.current.fired = false;
                      return;
                    }
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
