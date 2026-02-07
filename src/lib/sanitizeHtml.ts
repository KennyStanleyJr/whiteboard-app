/**
 * Sanitize HTML for rich text display and editing.
 * Allows only safe tags and a restricted set of inline style properties.
 */

const ALLOWED_TAGS = new Set([
  "br",
  "p",
  "div",
  "span",
  "b",
  "i",
  "u",
  "strong",
  "em",
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  "font-size",
  "text-align",
  "color",
  "line-height",
]);

function parseStyle(style: string): string {
  if (!style || typeof style !== "string") return "";
  const result: string[] = [];
  const parts = style.split(";");
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon <= 0) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (ALLOWED_STYLE_PROPERTIES.has(prop) && value.length > 0) {
      result.push(`${prop}: ${value}`);
    }
  }
  return result.length > 0 ? result.join("; ") : "";
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Max recursion depth when walking DOM (bounded per NASA-style rules). */
const MAX_SANITIZE_DEPTH = 50;

function sanitizeNode(node: Node, out: string[], depth: number): void {
  if (depth > MAX_SANITIZE_DEPTH) {
    out.push(escapeText(node.textContent ?? ""));
    return;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(escapeText(node.textContent ?? ""));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    for (let i = 0; i < el.childNodes.length; i++) {
      sanitizeNode(el.childNodes[i]!, out, depth + 1);
    }
    return;
  }
  const style = el.getAttribute("style");
  const styleStr = style != null ? parseStyle(style) : "";
  const safeStyle =
    styleStr &&
    styleStr
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const attrs = safeStyle ? ` style="${safeStyle}"` : "";
  out.push(`<${tag}${attrs}>`);
  for (let i = 0; i < el.childNodes.length; i++) {
    sanitizeNode(el.childNodes[i]!, out, depth + 1);
  }
  if (tag !== "br") {
    out.push(`</${tag}>`);
  }
}

/**
 * Sanitize HTML string for safe use in innerHTML / dangerouslySetInnerHTML.
 * Allows only br, p, div, span, b, i, u, strong, em and style with
 * font-size, text-align, color, line-height.
 */
export function sanitizeHtml(html: string): string {
  if (html.trim() === "") return "";
  const doc = document.implementation.createHTMLDocument("");
  const body = doc.body;
  body.innerHTML = html;
  const out: string[] = [];
  const startDepth = 0;
  for (let i = 0; i < body.childNodes.length; i++) {
    sanitizeNode(body.childNodes[i]!, out, startDepth);
  }
  return out.join("");
}

/**
 * Convert plain text to minimal safe HTML (preserve newlines as <br>).
 * Use when initializing content that was previously plain text.
 */
export function plainTextToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br>");
}

/** True if content appears to be HTML (contains tags). */
export function isHtmlContent(content: string): boolean {
  return content.includes("<");
}

/**
 * If content is exactly one <span style="color: ...">...</span>, return inner content;
 * otherwise return the content as-is. Use when applying a new color so we replace
 * instead of nesting color spans.
 */
export function innerContentIfSingleColorSpan(html: string): string {
  const parsed = parseSingleColorSpan(html);
  return parsed ? parsed.inner : html;
}

/**
 * If content is exactly one <span style="...">...</span> with a color in style,
 * return { style, inner } so callers can keep the color on the outside when
 * wrapping inner with format tags (e.g. <u>). Ensures underline uses currentColor from the span.
 */
export function parseSingleColorSpan(html: string): { style: string; inner: string } | null {
  const trimmed = html.trim();
  if (trimmed === "") return null;
  const m = trimmed.match(/^\s*<span\s+style="([^"]*)"\s*>([\s\S]*?)<\/span>\s*$/i);
  if (!m || !/color\s*:/i.test(m[1]!)) return null;
  return { style: m[1]!, inner: m[2]! };
}

/**
 * Check if content has no actual text characters (after stripping HTML tags).
 * Returns true if content is empty or contains only whitespace/HTML tags.
 */
export function hasNoTextCharacters(content: string): boolean {
  if (content.trim() === "") return true;
  if (!isHtmlContent(content)) return false;
  // Use a temporary DOM element to extract text content
  const doc = document.implementation.createHTMLDocument("");
  const body = doc.body;
  body.innerHTML = content;
  const textContent = body.textContent ?? "";
  return textContent.trim().length === 0;
}
