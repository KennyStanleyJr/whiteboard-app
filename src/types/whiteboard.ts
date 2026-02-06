export type ElementKind = "text";

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  kind: ElementKind;
}

export type FontSizeUnit = "px" | "pt";

export type TextAlign = "left" | "center" | "right";

export type TextVerticalAlign = "top" | "middle" | "bottom";

export interface TextElement extends BaseElement {
  kind: "text";
  /** HTML content (sanitized). Legacy plain text is supported for display. */
  content: string;
  /** Explicit size after resize; when set, overrides measured/default bounds. */
  width?: number;
  height?: number;
  /** Font size for display; default 16. */
  fontSize?: number;
  /** Unit for fontSize; default "px". */
  fontSizeUnit?: FontSizeUnit;
  /** Block text alignment. */
  textAlign?: TextAlign;
  /** Vertical alignment of text within the box. */
  textVerticalAlign?: TextVerticalAlign;
}

export type WhiteboardElement = TextElement;
