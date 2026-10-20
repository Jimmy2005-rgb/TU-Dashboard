/**
 * Normalise AI text so remark-math renders it:
 * - \( … \) → $ … $ and \[ … \] → $$ … $$ (models use both styles)
 * - money like "$100" or "$1,250.50 and $30" is escaped so it isn't read as maths
 *   (a "$" before a number only opens maths when the number is directly closed by another "$", e.g. "$5$").
 */
export function prepareMath(text: string): string {
  // Leave fenced and inline code alone.
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : convert(part)))
    .join("");
}

function convert(s: string): string {
  return s
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, m: string) => `$${m.trim()}$`)
    // A line that is only $$…$$ becomes a centred display equation.
    .replace(/^[ \t]*\$\$([^\n]+?)\$\$[ \t]*$/gm, (_, m: string) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/(^|[^\\$\w])\$(?=\d[\d,]*(?:\.\d+)?(?![\d,.]*\$)(?:[\s.,;:!?)\]]|$))/gm, "$1\\$");
}
