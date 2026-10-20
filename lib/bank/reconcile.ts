// Suggests which open invoice (money in) or expense (money out) a bank movement pays.
// Only exact amounts qualify; partial payments are out of scope.

export interface MovementForMatch {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
}

export interface MatchCandidate {
  type: "invoice" | "expense";
  id: string;
  reference: string | null; // invoice number or supplier invoice number
  contactName: string;
  date: string; // YYYY-MM-DD
  totalCents: number;
}

export interface MatchSuggestion extends MatchCandidate {
  score: number;
  reasons: string[];
}

const simplify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const STOPWORDS = new Set(["SL", "SA", "SC", "SLU", "SLL", "GMBH", "SARL", "LTD", "CB", "DE", "LA", "EL", "Y"]);

export function nameMentioned(description: string, name: string): boolean {
  const desc = ` ${description.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()} `;
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return words.length > 0 && words.some((w) => desc.includes(` ${w} `) || desc.includes(` ${w},`));
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

// A payment can't precede its document by more than this (early transfers happen, but rarely).
const MAX_DAYS_BEFORE = 5;

export function suggestMatches(movement: MovementForMatch, candidates: MatchCandidate[], limit = 3): MatchSuggestion[] {
  const wanted = movement.amountCents > 0 ? "invoice" : "expense";
  const amount = Math.abs(movement.amountCents);

  return candidates
    .filter((c) => c.type === wanted && c.totalCents === amount && dayDiff(movement.date, c.date) >= -MAX_DAYS_BEFORE)
    .map((c) => {
      const reasons = ["Mismo importe"];
      let score = 100;
      if (c.reference && simplify(c.reference).length >= 3 && simplify(movement.description).includes(simplify(c.reference))) {
        score += 100;
        reasons.push(`El concepto menciona ${c.reference}`);
      }
      if (nameMentioned(movement.description, c.contactName)) {
        score += 50;
        reasons.push(`El concepto menciona a ${c.contactName}`);
      }
      // Closer dates rank higher; a payment months later still qualifies on amount alone.
      score -= Math.min(Math.abs(dayDiff(movement.date, c.date)), 90) / 3;
      return { ...c, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
