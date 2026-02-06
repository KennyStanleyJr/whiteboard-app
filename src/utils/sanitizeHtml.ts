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

function sanitizeNode(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push(escapeText(node.textContent ?? ""));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    for (let i = 0; i < el.childNodes.length; i++) {
      sanitizeNode(el.childNodes[i]!, out);
    }
    return;
  }
  const style = el.getAttribute("style");
  const styleStr = style != null ? parseStyle(style) : "";
  const attrs = styleStr ? ` style="${styleStr.replace(/"/g, "&quot;")}"` : "";
  out.push(`<${tag}${attrs}>`);
  for (let i = 0; i < el.childNodes.length; i++) {
    sanitizeNode(el.childNodes[i]!, out);
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
  for (let i = 0; i < body.childNodes.length; i++) {
    sanitizeNode(body.childNodes[i]!, out);
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
