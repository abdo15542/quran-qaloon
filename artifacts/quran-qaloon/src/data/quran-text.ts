// Quran text bundled offline — Qaloon 'an Nafi' ONLY (1.0.115).
// Source: the verified Qaloon text in ./quran-text-qaloon.ts (KFGQPC v8,
// 6,236/6,236 exact against fawazahmed0/quran-api ara-quranqaloon v8).
// The Hafs literal that used to live in this file was deleted in 1.0.115:
// there is no other narration in the app any more — no Hafs, no Warsh.
// No network is needed to read the text, search it, or show ayah context.
// Audio is still streamed/downloaded on demand from the reciter CDNs.
// NOTE: as in the source, the Basmala is included at the start of
// ayah 1 of every surah except 9 (and is ayah 1 of surah 1 itself).
import { QURAN_TEXT_QALOON } from "./quran-text-qaloon";
import { DAGGER_ALIF_FIXES } from "./dagger-alif-fixes";

export interface LocalAyah {
  number: number;
  numberInSurah: number;
  text: string;
}

// QURAN_TEXT[surahNumber - 1] = ayah texts in order.
// 1.0.115: Qaloon ONLY — the single bundled text is QURAN_TEXT_QALOON
// (see ./quran-text-qaloon.ts; keep that file pure v8).
export const QURAN_TEXT: string[][] = QURAN_TEXT_QALOON;

// The bundled text table. 1.0.115: Qaloon only — the qirahId parameter
// is kept so existing callers need no change, but it is ignored: there is
// no other text in the app any more.
export function getTextTable(_qirahId?: string): string[][] {
  return QURAN_TEXT;
}

export function getSurahAyahs(surahNumber: number, qirahId?: string): LocalAyah[] {
  const texts = getTextTable(qirahId)[surahNumber - 1];
  if (!texts) return [];
  return texts.map((text, i) => ({
    number: i + 1,
    numberInSurah: i + 1,
    text,
  }));
}

export function getAyah(surahNumber: number, ayahNumber: number, qirahId?: string): LocalAyah | null {
  const texts = getTextTable(qirahId)[surahNumber - 1];
  if (!texts || ayahNumber < 1 || ayahNumber > texts.length) return null;
  return { number: ayahNumber, numberInSurah: ayahNumber, text: texts[ayahNumber - 1] };
}

// The Basmala prefixes ayah 1 of every surah (except 9) in the bundled
// text — but it is NOT part of the ayah: the surah header already shows
// it, and for surah 1 it IS ayah 1. Any code that displays an ayah's text
// must strip the prefix, or the user sees the Basmala twice (seen on
// video in 1.0.70: the verse-of-day card and the player both showed it).
// The literal is byte-identical to the prefix in the bundled Qaloon text
// (verified: it prefixes ayah 1 of surahs 2-114 except 9, 113 times;
// surah 1 ayah 1 equals it exactly — 1:4 reads «مَلِكِ», Qaloon).
export const BASMALA = "بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ";

/** Split ayah 1's Basmala prefix off: { basmala, rest }. Only ayah 1 of
    surahs 2-114 (not 9) carries the prefix; surah 1 ayah 1 IS the
    Basmala and is returned whole (basmala=false). */
export function splitAyahBasmala(
  surahNumber: number,
  ayahNumber: number,
  text: string
): { basmala: boolean; rest: string } {
  if (
    ayahNumber === 1 &&
    surahNumber !== 1 &&
    surahNumber !== 9 &&
    text.startsWith(BASMALA)
  ) {
    return { basmala: true, rest: text.slice(BASMALA.length).trim() };
  }
  return { basmala: false, rest: text };
}

/** Plain display text of an ayah (no TajweedText window needed). */
export function displayAyahText(
  surahNumber: number,
  ayahNumber: number,
  text: string
): string {
  return splitAyahBasmala(surahNumber, ayahNumber, text).rest;
}

// Uthmani spellings use و where modern spelling uses ا in a handful of
// words (الصلوة = الصلاة، الزكوة = الزكاة ...). After the ة→ه step below
// these become الصلوه/الزكوه/... — map them to the modern form so a search
// typed in modern spelling finds them.
const UTHMANI_WORD_FIXES: Array<[RegExp, string]> = [
  [/الصلوه/g, "الصلاه"],
  [/الزكوه/g, "الزكاه"],
  [/الحيوه/g, "الحياه"],
  [/الربوا/g, "الربا"],
  [/مشكوه/g, "مشكاه"],
  [/منوه/g, "مناه"],
  [/النجوه/g, "النجاه"],
  [/الغدوه/g, "الغداه"],
  // اللائي: the article's ل and the pronoun's ل merge into one written ل
  // with shadda (ٱلَّٰٓـِٔى), so the text normalises to one ل where the
  // query has two. Longer form first so it is not half-replaced.
  [/الايين/g, "اللايين"],
  [/الايي/g, "اللايي"],
  // سأل family: the Uthmani text drops the alef after ف/و (فَسْـَٔلُوا،
  // وَسْـَٔلِ) while the modern spelling keeps it (فاسألوا، واسأل).
  // Longer form first.
  [/فسالوا/g, "فاسالوا"],
  [/فسال/g, "فاسال"],
  [/وسال/g, "واسال"],
  // Qaloon (1.0.115): «كَهَيْـَٔةِ» (3:49, 5:110) writes the hamza of
  // هيئة with a fatha before the mark, so the seat rule gives ا («كهياه»)
  // where Hafs writes it with a kasra after the mark and gives ئ («كهييه»).
  // Same word — the query «هيئة» must find both.
  [/كهياه/g, "كهييه"],
  // Qaloon (1.0.115): the seat rule writes an extra و in «النَّبِيٓـُٔونَ»
  // (the ٔ there is orthographic — «النَّبِيُّونَ» has no hamza), so the
  // Qaloon form «النبيوون» never matches a query for «النبيون» (3×).
  // Longer form first.
  [/والنبيوون/g, "والنبيون"],
  [/النبيوون/g, "النبيون"],
  // Qaloon (1.0.115): in 22:65 السماء is written with a bare alef and
  // no hamza at all («السَّمَا») — not even the small zero ۟ the other
  // four such spellings carry (those are restored by the forSearch rule
  // above). Whole-word only: «السماوات» must not match.
  [/(^|\s)السما(?=\s|$)/g, "$1السماء"],
  // يئوس / اخسئوا: the hamza's seat is ئ by the root's own vowel pattern
  // (يَئِسَ، خَسِئَ), which no local context rule can see — the general
  // rule gives ؤ here, so correct these four words explicitly.
  [/ليووس/g, "لييوس"],
  [/يووسا/g, "ييوسا"],
  [/فيووس/g, "فييوس"],
  [/اخسووا/g, "اخسيوا"],
];

// Helpers for the bare-hamza seat rule in normalizeArabic: the scan skips
// the same marks the strip removes, EXCEPT dagger alif (U+0670) and the
// small waw/yeh (U+06E5/U+06E6), which are letters, not marks.
const HAMZA_SCAN_SKIP =
  /[\u064B-\u0653\u065C\u0640\u06D6-\u06DC\u06DE-\u06E4\u06E7-\u06ED\u08F0-\u08F2]/;
const HAMZA_VOWEL = /[\u064B\u064C\u064D\u064E\u064F\u0650\u0652]/;
function hamzaVowelStrength(c: string): number {
  if (c === "\u0650" || c === "\u064D") return 3; // kasra / kasratan
  if (c === "\u064F" || c === "\u064C") return 2; // damma / dammatan
  if (c === "\u064E" || c === "\u064B") return 1; // fatha / fathatan
  return 0; // sukun / none
}

// (1.0.115) The hizb marker ۞ (U+06DE) is stripped too: in the Qaloon
// text it is GLUED to the first word of hizb-start ayahs («۞يَٰأَيُّهَا»),
// so without this the token never matches its query word and phrases
// starting at a hizb boundary («يا أيها الذين آمنوا» in 17 ayahs) scored
// 0. In the Hafs text it stood alone as its own token, so stripping it
// changes nothing there — it never matched a query word either way.
// Strip tashkeel/tatweel and normalise alef/ya forms so a search typed
// without diacritics still matches the fully vocalised Uthmani text.
// Also strips Qaloon-specific marks (U+08F0–U+08F2 tanwin, U+06EC) and
// maps Qaloon rasm variants (U+06D2 «ے» -> ya) so searching the Qaloon
// text works the same way.
// Two more unifications, so common modern spellings find the Uthmani
// text: «ءا» (hamza + alef, e.g. «ءامنوا», «الءاخرة») -> «ا», so
// «آمنوا» matches «ءامنوا»; and the Uthmani و-words above -> modern ا.
//
// The dagger alif (U+0670) needs special care — it is a real alef in some
// words (الصِّرَٰطَ = الصراط، مَٰلِكِ = مالك، ٱلسَّمَٰوَٰتِ = السماوات)
// and only a flourish in others (هَٰذَا = هذا، عَلَىٰ = على، ٱلرَّحْمَٰنِ
// = الرحمن). The strip set also removes maddah (U+0653) — without it
// الضَّآلِّينَ، ٱلسَّمَآءُ، جَآءَ، شَآءَ never matched. Hamza-above (U+0654)
// is NOT a pure diacritic here: in the bundled text it always stands
// bare after a consonant (يَسْـَٔلُونَكَ = يسألونك — 496 occurrences,
// 0 seated), so it is mapped to «ا» BEFORE the strip; deleting it made
// those words unsearchable (يسألونك → يسلونك ≠ يسالونك). Hamza-below
// (U+0655) does not occur in the bundled text at all, so it stays in the
// strip set. The default is to map
// U+0670 to «ا»; DAGGER_ALIF_FIXES (generated from the bundled text, see
// dagger-alif-fixes.ts) then corrects, per word, the cases where the dagger
// alif is a flourish. That table must run on the TEXT side only — queries
// are typed in modern spelling, so pass applyDaggerFixes=false for them
// (a query word like «عليا» must stay «عليا», not become «علي»).
export function normalizeArabic(s: string, applyDaggerFixes = true, keepMadda = false, forSearch = false): string {
  let out = s
    // QAC quirk: shadda (U+0651) is written BEFORE the vowel it doubles
    // in 22,420 QAC lines. Canonicalise to vowel-then-shadda so both
    // sides compare the same way. Also strip U+200F (right-to-left mark),
    // which appears in some copied text. Both are no-ops for the search
    // (the strip below removes shadda and vowels anyway); they only make
    // the pre-strip form canonical.
    .replace(/\u200F/g, "")
    .replace(/\u0651([\u064B-\u0650\u0652])/g, "$1\u0651")
    // Qaloon (KFGQPC v8) writes the hamza seats ؤ/ئ DECOMPOSED: the seat
    // letter و/ي followed directly — only a vowel/sukun between, NO
    // tatweel — by the bare hamza mark U+0654, e.g. «يُؤْمِنُونَ»
    // (يؤمنون), «أُولَٰٓئِكَ» (أولئك), «اَ۬لْغَآئِطِ» (الغائط). The
    // seat letter already stands for ؤ/ئ, so the mark itself
    // contributes nothing: drop it, keeping the vowel. Without this the
    // text normalises with a doubled seat («يوومنون») while a query
    // typed with ؤ/ئ has one («يومنون») and never matches. A tatweel
    // between seat and mark (ـٔ — the spelling of a SEPARATE hamza,
    // e.g. «شَيْـًٔا») is NOT collapsed: the seat rule below still
    // handles it exactly as before. (1.0.115: verified live — Hafs has
    // 36 U+0654s, all on a tatweel; Qaloon has 11,198, 1,766 of them
    // directly after و/ي.)
    // EXCEPTION — a sukun between the seat and the mark AND a fatha on
    // the letter before the seat («شَئْا» = شيئا، 77×): the seat is a
    // quiescent diphthong glide and the mark is a SEPARATE hamza, so it
    // becomes a second seat letter instead of vanishing — the modern
    // spelling has two («شييا»). A sukun after a damma («يُؤْمِنُونَ»
    // = يؤمنون) is the opposite: the seat carries the hamza, drop it.
    .replace(
      /([\u0648\u064A])([\u064B-\u0650\u0652])?\u0654/g,
      (_m: string, seat: string, vowel: string | undefined, off: number, str: string) =>
        vowel === "\u0652" && str[off - 1] === "\u064E" ? seat + vowel + seat : seat + (vowel ?? "")
    )
    // A bare hamza-above (U+0654) is written on a tatweel seat (ـٔ) and its
    // true seat depends on context — a blanket map to «ا» fixed يسألونك
    // but broke الآن (→ الاان) and شيئا (→ شياا). Seat rules, in order:
    //  - after a sakinah/kasra yeh → ئ (ي): شَيْـًٔا = شيئا، سَيِّـَٔاتِ = سيئات
    //  - after waw / small waw → ؤ (و)
    //  - on an already-written alef with a weak vowel → drop it:
    //    ٱدَّٰرَْٰٔتُمْ = ادارأتم (the dagger alif IS the seat)
    //  - before an alef (آ = hamza + alef) → drop it: ٱلْـَٰٔنَ = الآن، بِـَٔايَٰتِ = بآيات
    //  - otherwise the stronger vowel decides (kasra > damma > fatha):
    //    ئ (ي) / ؤ (و) / أ (ا) — أَفْـِٔدَة = أفئدة، مَسْـُٔول = مسؤول، يَسْـَٔل = يسأل
    .replace(/\u0654/g, (_m: string, off: number, str: string) => {
      // previous base letter + its vowel (scan back past tatweel/diacritics;
      // dagger alif, small waw/yeh are letters, not skipped)
      let prev = "";
      let vPrev = "";
      for (let j = off - 1; j >= 0; j--) {
        const c = str[j];
        if (HAMZA_SCAN_SKIP.test(c)) {
          if (!vPrev && HAMZA_VOWEL.test(c)) vPrev = c;
          continue;
        }
        prev = c;
        break;
      }
      // next base letter + the hamza's own vowel
      let next = "";
      let vNext = "";
      for (let j = off + 1; j < str.length; j++) {
        const c = str[j];
        if (HAMZA_SCAN_SKIP.test(c)) {
          if (!vNext && HAMZA_VOWEL.test(c)) vNext = c;
          continue;
        }
        next = c;
        break;
      }
      const sPrev = hamzaVowelStrength(vPrev);
      const sNext = hamzaVowelStrength(vNext);
      const isAlef = (c: string) =>
        c === "\u0627" || c === "\u0622" || c === "\u0670" || c === "\u0671";
      if ((prev === "\u064A" || prev === "\u06E6") && (sPrev === 0 || sPrev === 3))
        return "\u064A";
      if (prev === "\u0648" || prev === "\u06E5") return "\u0648";
      // Decomposed أ/إ: the mark sits DIRECTLY on an alef (ا أ إ آ ٱ ٰ)
      // — no tatweel between — so the alef already IS the hamza's seat
      // and the mark adds nothing (Qaloon «أُوْلَٰٓئِكَ» = أولئك,
      // «أَلَٓمِّٓ» = الم). Drop it whatever the vowels are: without
      // this, a damma'd alef («أُوْ») fell through to the
      // vowel-strength branch below, which invented a و («اوولايك»)
      // and broke every «أولئك» (204×) in the Qaloon text. A tatweel
      // between alef and mark (ـٔ) means the mark is a separate hamza
      // — the scan below stops at the tatweel, so this branch does not
      // fire and the old rules still apply.
      {
        let k = off - 1;
        while (k >= 0 && HAMZA_VOWEL.test(str[k])) k--;
        if (isAlef(str[k] ?? "")) return "";
      }
      if (isAlef(prev) && Math.max(sPrev, sNext) <= 1 && !isAlef(next)) return "";
      if (isAlef(next)) return "";
      const st = Math.max(sPrev, sNext);
      if (st === 3) return "\u064A";
      if (st === 2) return "\u0648";
      return "\u0627";
    });
    // (1.0.115, search only — never on displayed/counted forms) Qaloon
    // hamza equivalences, so a modern-spelling query finds the Qaloon
    // spelling of the same word:
    //  - a bare ء (U+0621) after a seat letter و/ي is the same hamza the
    //    modern spelling writes as ئ/ؤ («شيء» = the stem of «شيئا»،
    //    «سوء»، «بريء»): double the seat, exactly as the bare-hamza rule
    //    does for the tatweel spelling («شَيْـًٔا» -> «شييا»). Without
    //    this «شيئا» scored 0 in the Qaloon text (77 in Hafs).
    //  - a word-final alef carrying the small zero ۟ (U+06DF) stands for
    //    a final hamza in the Qaloon spelling («السَّمَآ۟» = السماء،
    //    «هَٰؤُلَآ۟» = هؤلاء، «وَرَا۟» = وراء): restore the ء. Only
    //    word-final (space / pause mark / end follows) — a medial ۟ is a
    //    silent alef («اُ۟عْبُدُواْ» = اعبدوا) and is left alone — AND
    //    only when a vowel sits right before the alef: a bare long-vowel
    //    letter before it («آمَنُوا۟»، «تَقُولُوا۟») means the alef is the
    //    silent plural alif, not a hamza. Without the vowel guard every
    //    «ـوا۟» ending became «واء» and broke Hafs phrase search.
    if (forSearch) {
      out = out
        .replace(/([\u0648\u064A\u06D2\u0649])[\u0653\u0652]?\u0621/g, "$1$1")
        .replace(/([\u064B-\u0652])\u0627(\u0653?)\u06DF(?=[\s\u06D6-\u06DC\u06DE\u06E9]|$)/g, "$1\u0627$2\u0621");
    }
  out = out
    // U+065C (imala mark, QAC writes it in 11:41 مَجْر۪ىٰهَا where the
    // bundled text uses a different mark) and U+06E9 (place of sajdah ۩,
    // which QAC attaches to the word at each sajdah while the bundled
    // text keeps it as a separate token) are non-letter Quranic marks:
    // strip them too, so a QAC form and its bundled form normalise the
    // same way. Both are marks only — no Arabic letter is ever removed.
    .replace(
      keepMadda
        // Same strip set, except maddah (U+0653) is KEPT: with keepMadda
        // the output distinguishes «الٓمٓ» (the disjointed letters) from
        // «أَلَمْ» (the interrogative) — see MUQATTAAT_STRICT below.
        // Never use keepMadda for ordinary matching: on ordinary words
        // maddah is only a length mark (جَآءَ = جاء) and must be ignored.
        ? /[\u064B-\u0652\u0654\u0655\u065C\u0640\u06D6-\u06DC\u06DE-\u06ED\u08F0-\u08F2]/g
        : /[\u064B-\u0655\u065C\u0640\u06D6-\u06DC\u06DE-\u06ED\u08F0-\u08F2]/g,
      ""
    )
    .replace(/\u0670/g, "\u0627")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0621\u0627/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u06D2/g, "\u064A")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064A");
  for (const [re, rep] of UTHMANI_WORD_FIXES) out = out.replace(re, rep);
  if (applyDaggerFixes) {
    out = out.replace(/\S+/g, (w) => DAGGER_ALIF_FIXES[w] ?? w);
  }
  return out;
}

// Letters that attach to the front of a word as clitics (conjunctions /
// prepositions). A search for a word matches it with up to two of these
// in front (e.g. «وبالله» matches «الله»).
const CLITIC_LETTERS = new Set(["و", "ف", "ب", "ك", "ل", "ت", "أ", "س"]);

// Does a single normalised word match a single normalised query word?
// The word matches when, after stripping up to two leading clitic
// letters, it equals the query word — or the query word + «م» (the
// vocative ending in «اللهم») — or the query's elided form (a query
// starting with «ال» written without its alef, e.g. «لله» for «الله»),
// which is only generated when it stays at least 3 letters long: a
// 2-letter elided form is a different word, not the article — «لم»
// for «الم» is the negation particle, not the disjointed letters
// «الٓمٓ»; «لن»/«لو»/«لا» likewise (1.0.112).
// Requiring a whole-word match (not a substring) keeps «الله» from
// matching the unrelated words «اللهو» (amusement) and «اللهب» (flame).
export function matchWord(word: string, queryWord: string): boolean {
  const forms = [queryWord];
  if (queryWord.startsWith("ال") && queryWord.length >= 4) forms.push("ل" + queryWord.slice(2));
  for (let p = 0; p <= 2 && p <= word.length; p++) {
    if (p > 0 && !CLITIC_LETTERS.has(word[p - 1])) break;
    const stem = word.slice(p);
    for (const f of forms) {
      if (stem === f || stem === f + "م") return true;
    }
  }
  return false;
}

// Phrase alignment (1.0.111): the Uthmani text sometimes writes two modern
// words as ONE token («يَٰٓأَيُّهَا» = «يا أيها»، «يَٰمُوسَىٰ» = «يا موسى»),
// so a word-by-word slide misses any longer phrase that starts with one:
// «يا أيها الذين آمنوا» scored 0 in 1.0.109/1.0.110 — the slide needs four
// separate tokens «يا» «ايها» «الذين» «امنوا» while the text has three,
// «ياايها» «الذين» «امنوا»; and the joined whole-phrase form
// «ياايهاالذينامنوا» matches no single token either. findPhraseMatches
// aligns the query words to the ayah tokens allowing, at each step,
// 1 token ↔ 1..m consecutive query words, or 2 tokens ↔ 1 query word
// (each step via matchWord, so clitic prefixes still apply). A token is
// always consumed whole, so a query word can never match half a token.
// Returns non-overlapping (start, end) token spans, shortest consumption
// first — the same counting semantics as the old slide. (The old joined
// whole-phrase form is a special case of the 1-token ↔ m-words step, so
// «يا أيها» still finds its 142 ayahs.)
export function findPhraseMatches(
  words: string[],
  queryWords: string[]
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  if (!queryWords.length || !words.length) return matches;
  const n = words.length;
  const m = queryWords.length;
  const memo = new Map<string, number[]>();
  const can = (i: number, k: number): number[] => {
    if (k >= m) return [i];
    if (i >= n) return [];
    const key = i + ":" + k;
    const hit = memo.get(key);
    if (hit) return hit;
    const ends: number[] = [];
    for (let take = 1; take <= m - k; take++) {
      if (matchWord(words[i], queryWords.slice(k, k + take).join(""))) {
        ends.push(...can(i + 1, k + take));
      }
    }
    if (i + 1 < n && matchWord(words[i] + words[i + 1], queryWords[k])) {
      ends.push(...can(i + 2, k + 1));
    }
    const uniq = [...new Set(ends)];
    memo.set(key, uniq);
    return uniq;
  };
  let j = 0;
  while (j < n) {
    const ends = can(j, 0);
    if (ends.length) {
      const end = Math.min(...ends);
      matches.push({ start: j, end });
      j = end;
    } else {
      j++;
    }
  }
  return matches;
}

export interface QuranSearchHit {
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
}

export interface QuranSearchHitDetailed extends QuranSearchHit {
  occurrences: number;
}

export interface QuranSearchDetailed {
  query: string;
  totalOccurrences: number;
  ayahCount: number;
  surahCount: number;
  hits: QuranSearchHitDetailed[];
}

// Full-Quran search: every matching ayah, with the number of times the
// query occurs in each ayah, plus the totals (occurrences / ayahs /
// surahs). A single-word query matches whole words (see matchWord); a
// multi-word query (a phrase or a verse) matches consecutive words.
// Runs over the bundled text, so it works fully offline.
// The normalised text (split into words) is cached per qira'ah —
// normalising all 6236 ayahs on every search is too slow for live search.
const normalizedWordsByQirah = new Map<string, string[][][]>();
function getNormalizedWords(qirahId?: string): string[][][] {
  const key = qirahId ?? "hafs";
  let cached = normalizedWordsByQirah.get(key);
  if (!cached) {
    const table = getTextTable(qirahId);
    cached = table.map((texts) => texts.map((t) => normalizeArabic(t, true, false, true).split(/\s+/)));
    normalizedWordsByQirah.set(key, cached);
  }
  return cached;
}

// The disjointed letters (al-huruf al-muqatta'at) — plain query form ->
// strict form (maddah U+0653 kept, via normalizeArabic keepMadda).
// Derived from the bundled text: the opening token of each muqatta'at
// surah (ayah 1, after the Basmala; 42:2 for عسق). Re-derived from the
// Qaloon text in 1.0.115 — identical to the Hafs table, so it is kept:
//   الم 2/3/29/30/31/32, المص 7, الر 10/11/12/14/15, المر 13,
//   كهيعص 19, طه 20, طسم 26/28, طس 27, يس 36, ص 38,
//   حم 40/41/42/43/44/45/46, عسق 42:2, ق 50, ن 68.
// A plain single-word search for one of these must match ONLY the
// opening spelling: after stripping, «الٓمٓ» and the interrogative
// «أَلَمْ» both normalise to «الم» (84 tokens), but the user asking
// for «الم» means the disjointed letters (6 openings). The strict
// form separates them — «الٓمٓ» keeps its maddahs, «أَلَمْ» has none.
// «طه» carries no maddah in the text, so its strict form is itself;
// it still needs the table entry, so the plain «طه» does not also
// match any other token that happens to normalise to «طه».
// Only single-word queries use this table (see searchQuranDetailed /
// highlightSegments): inside a phrase the context disambiguates, e.g.
// «ألم أقل لكم» is the phrase of 2:33 and must still find it.
const MUQATTAAT_STRICT: Record<string, string> = {
  "الم": "الٓمٓ",
  "المص": "الٓمٓصٓ",
  "الر": "الٓر",
  "المر": "الٓمٓر",
  "كهيعص": "كٓهيعٓصٓ",
  "طه": "طه",
  "طسم": "طسٓمٓ",
  "طس": "طسٓ",
  "يس": "يسٓ",
  "ص": "صٓ",
  "حم": "حمٓ",
  "عسق": "عٓسٓقٓ",
  "ق": "قٓ",
  "ن": "نٓ",
};

// Strict (maddah-kept) words, cached like getNormalizedWords — built
// lazily, only when a muqatta'at query is searched.
const strictWordsByQirah = new Map<string, string[][][]>();
function getStrictWords(qirahId?: string): string[][][] {
  const key = qirahId ?? "hafs";
  let cached = strictWordsByQirah.get(key);
  if (!cached) {
    const table = getTextTable(qirahId);
    cached = table.map((texts) => texts.map((t) => normalizeArabic(t, true, true, true).split(/\s+/)));
    strictWordsByQirah.set(key, cached);
  }
  return cached;
}

// Characters that appear in copied/pasted Quran text but are never
// searchable words in the bundled ayah text: ornate ayah brackets ﴿ ﴾
// (U+FD3E/U+FD3F), end-of-ayah sign ۝ (U+06DD), hizb marker ۞ (U+06DE),
// sajdah sign ۩ (U+06E9), Arabic punctuation (، ؛ ؟ «» “” ‘’ … . ! : -
// ( ) [ ]) and ayah numbers (Arabic-Indic, extended Arabic-Indic and
// Western digits). A paste like «﴿إِيَّاكَ نَعْبُدُ وَإِيَّاكَ
// نَسْتَعِينُ﴾ ٥» must match ayah 1:5 — without this, the brackets, the
// sign and the digit become part of the query words and nothing matches
// (verified 1.0.108). Applied to the QUERY only; the bundled text is
// never touched.
export function cleanSearchQuery(query: string): string {
  return query
    .replace(/[﴿﴾۝۞۩]/g, " ")
    .replace(/[،؛؟«»""''…\.!:\-\(\)\[\]]/g, " ")
    .replace(/[٠-٩۰-۹0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchQuranDetailed(query: string, qirahId?: string): QuranSearchDetailed {
  const q = normalizeArabic(cleanSearchQuery(query.trim()), false, false, true);
  const queryWords = q.split(/\s+/).filter(Boolean);
  const empty: QuranSearchDetailed = { query: query.trim(), totalOccurrences: 0, ayahCount: 0, surahCount: 0, hits: [] };
  if (!queryWords.length) return empty;
  const table = getTextTable(qirahId);
  const normWords = getNormalizedWords(qirahId);
  const hits: QuranSearchHitDetailed[] = [];
  let total = 0;
  const surahsSeen = new Set<number>();
  // A muqatta'at query («الم» …) matches only the opening spelling
  // (strict form, maddah kept) — see MUQATTAAT_STRICT.
  const strictTarget = queryWords.length === 1 ? MUQATTAAT_STRICT[queryWords[0]] : undefined;
  const strictWords = strictTarget !== undefined ? getStrictWords(qirahId) : null;
  for (let s = 0; s < table.length; s++) {
    const texts = table[s];
    const wordsByAyah = normWords[s];
    for (let i = 0; i < texts.length; i++) {
      const words = wordsByAyah[i];
      let occ = 0;
      if (queryWords.length === 1) {
        if (strictTarget !== undefined && strictWords) {
          for (const w of strictWords[s][i]) if (w === strictTarget) occ++;
        } else {
          for (const w of words) if (matchWord(w, queryWords[0])) occ++;
        }
      } else {
        // Merge-aware alignment (see findPhraseMatches): the text may
        // write two query words as one token («ياايها») or split one
        // query word over two tokens.
        occ += findPhraseMatches(words, queryWords).length;
      }
      if (occ > 0) {
        total += occ;
        surahsSeen.add(s + 1);
        hits.push({ number: i + 1, numberInSurah: i + 1, text: texts[i], surahNumber: s + 1, occurrences: occ });
      }
    }
  }
  return { query: query.trim(), totalOccurrences: total, ayahCount: hits.length, surahCount: surahsSeen.size, hits };
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

// Split an ayah's original (diacritic) text into segments, marking the
// words that match the query — using the same word matching as
// searchQuranDetailed, so the highlight always agrees with the count.
// Normalisation never adds or removes spaces, BUT it can delete a whole
// token: a lone Quranic pause mark (ۖ ۗ ۚ ۙ ۘ ۛ ۜ ۩) normalises to ""
// and drops out of the normalised word list, while it stays a word in
// the original text — so the n-th normalised word is NOT always the
// n-th original word (1.0.112: in 2:33 the ۖ before «أَلَمْ» shifted the
// highlight onto the preceding «قَالَ»). The walk below therefore skips
// original words that normalise to nothing, so each highlighted word is
// the word that actually matched.
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const q = normalizeArabic(cleanSearchQuery(query.trim()), false, false, true);
  const queryWords = q.split(/\s+/).filter(Boolean);
  if (!queryWords.length) return [{ text, matched: false }];
  const normWords = normalizeArabic(text, true, false, true).split(/\s+/);
  const matched = new Array<boolean>(normWords.length).fill(false);
  if (queryWords.length === 1) {
    const strictTarget = MUQATTAAT_STRICT[queryWords[0]];
    if (strictTarget !== undefined) {
      const strictWords = normalizeArabic(text, true, true, true).split(/\s+/);
      for (let i = 0; i < strictWords.length; i++) matched[i] = strictWords[i] === strictTarget;
    } else {
      for (let i = 0; i < normWords.length; i++) matched[i] = matchWord(normWords[i], queryWords[0]);
    }
  } else {
    // Same merge-aware alignment as searchQuranDetailed, so the highlight
    // always agrees with the count.
    for (const m of findPhraseMatches(normWords, queryWords)) {
      for (let i = m.start; i < m.end; i++) matched[i] = true;
    }
  }
  const parts = text.split(/(\s+)/);
  const segments: HighlightSegment[] = [];
  let ni = 0; // index into normWords (and matched[])
  for (const part of parts) {
    if (part === "") continue;
    if (/^\s+$/.test(part)) { segments.push({ text: part, matched: false }); continue; }
    // A word that normalises to nothing (a lone pause mark) has no slot
    // in normWords: never highlighted, and it does not shift later words.
    if (normalizeArabic(part, true, false, true) === "") { segments.push({ text: part, matched: false }); continue; }
    segments.push({ text: part, matched: matched[ni] ?? false });
    ni++;
  }
  return segments;
}


