import { parseSingleColorSpan } from "./sanitizeHtml";

/** We only output <b>, <i>, <u>. strong/em are recognized for strip/detect only. */
const BOLD_TAGS = [
  ["b", "b"],
  ["strong", "strong"],
] as const;
const ITALIC_TAGS = [
  ["i", "i"],
  ["em", "em"],
] as const;
const UNDERLINE_TAGS = [["u", "u"]] as const;

export type FormatTag = "b" | "i" | "u";

function getTagPairs(tag: FormatTag): readonly (readonly [string, string])[] {
  return tag === "b" ? BOLD_TAGS : tag === "i" ? ITALIC_TAGS : UNDERLINE_TAGS;
}

function unwrapIfSingleTag(
  html: string,
  tagPairs: readonly (readonly [string, string])[]
): string | null {
  const trimmed = html.trim();
  if (trimmed === "") return null;
  for (const [open, close] of tagPairs) {
    const re = new RegExp(`^<${open}>([\\s\\S]*)<\\/${close}>$`, "i");
    const m = trimmed.match(re);
    const inner = m?.[1];
    if (inner !== undefined) return inner;
  }
  return null;
}

const ALL_FORMAT_TAG_PAIRS: readonly (readonly [string, string])[] = [
  ...BOLD_TAGS,
  ...ITALIC_TAGS,
  ...UNDERLINE_TAGS,
];

function isPairForTag(
  pair: readonly [string, string],
  tag: FormatTag
): boolean {
  const tagPairs = getTagPairs(tag);
  return tagPairs.some(([o, c]) => o === pair[0] && c === pair[1]);
}

function getInnerForFormatCheck(content: string): string {
  const parsed = parseSingleColorSpan(content);
  return parsed ? parsed.inner : content;
}

function innerHasFormat(html: string, tag: FormatTag): boolean {
  const tagPairs = getTagPairs(tag);
  if (unwrapIfSingleTag(html, tagPairs) !== null) return true;
  for (const pair of ALL_FORMAT_TAG_PAIRS) {
    if (isPairForTag(pair, tag)) continue;
    const unwrapped = unwrapIfSingleTag(html, [pair]);
    if (unwrapped !== null) return innerHasFormat(unwrapped, tag);
  }
  return false;
}

/** True if content has the format (supports nested b/i/u and optional color span). */
export function hasFormat(content: string, tag: FormatTag): boolean {
  const inner = getInnerForFormatCheck(content);
  return innerHasFormat(inner, tag);
}

/**
 * Add exactly one layer of format (b, i, or u). Strips any existing layers first
 * so we never produce nested bold/italic/underline (no extrabold).
 */
function wrapWithFormatPreservingColor(content: string, tag: FormatTag): string {
  const stripped = stripFormatPreservingColor(content, tag);
  const parsed = parseSingleColorSpan(stripped);
  if (parsed) {
    const raw = parsed.inner.trim() || " ";
    const wrapped = `<${tag}>${raw}</${tag}>`;
    return `<span style="${parsed.style}">${wrapped}</span>`;
  }
  const raw = stripped.trim() || " ";
  return `<${tag}>${raw}</${tag}>`;
}

/**
 * Unwrap one layer of the target tag from html. If html is wrapped in other
 * format tags, recurse in and unwrap the target, then reassemble (so order
 * doesn't matter when toggling).
 */
function unwrapOneLayer(html: string, tag: FormatTag): string | null {
  const tagPairs = getTagPairs(tag);
  const inner = unwrapIfSingleTag(html, tagPairs);
  if (inner !== null) return inner;
  for (const pair of ALL_FORMAT_TAG_PAIRS) {
    if (isPairForTag(pair, tag)) continue;
    const outerInner = unwrapIfSingleTag(html, [pair]);
    if (outerInner !== null) {
      const innerUnwrapped = unwrapOneLayer(outerInner, tag);
      if (innerUnwrapped !== null)
        return `<${pair[0]}>${innerUnwrapped}</${pair[1]}>`;
    }
  }
  return null;
}

/** Max iterations when stripping format layers (bounded loop per NASA-style rules). */
const MAX_STRIP_ITERATIONS = 100;

/**
 * Strip all layers of the given format (e.g. all <b> and <strong> for bold)
 * so we never have nested bold / extrabold. Preserves color span.
 * Loop is bounded by MAX_STRIP_ITERATIONS to satisfy analyzable control flow.
 */
function stripFormatPreservingColor(content: string, tag: FormatTag): string {
  const parsed = parseSingleColorSpan(content);
  let inner = parsed ? parsed.inner : content;
  for (let i = 0; i < MAX_STRIP_ITERATIONS; i++) {
    const next = unwrapOneLayer(inner, tag);
    if (next === null) break;
    inner = next;
  }
  return parsed
    ? `<span style="${parsed.style}">${inner}</span>`
    : inner;
}

/** Toggle format on whole content: wrap if missing, unwrap if present. */
export function applyFormatToContent(content: string, tag: FormatTag): string {
  const has = hasFormat(content, tag);
  return has ? stripFormatPreservingColor(content, tag) : wrapWithFormatPreservingColor(content, tag);
}

/** Add format (wrap) if not already present; preserves color span. */
export function addFormatToContent(content: string, tag: FormatTag): string {
  return wrapWithFormatPreservingColor(content, tag);
}

/** Remove format (unwrap) if present; preserves color span. */
export function removeFormatFromContent(content: string, tag: FormatTag): string {
  return stripFormatPreservingColor(content, tag);
}
