export type ElementKind = "text" | "shape";

export type ShapeType = "rectangle" | "ellipse";

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  kind: ElementKind;
}

export type TextAlign = "left" | "center" | "right";

export type TextVerticalAlign = "top" | "middle" | "bottom";

export interface TextElement extends BaseElement {
  kind: "text";
  /** HTML content (sanitized). Legacy plain text is supported for display. */
  content: string;
  /** Explicit size after resize; when set, overrides measured/default bounds. */
  width?: number;
  height?: number;
  /** Font size in px for display; default 24. */
  fontSize?: number;
  /** Block text alignment. */
  textAlign?: TextAlign;
  /** Vertical alignment of text within the box. */
  textVerticalAlign?: TextVerticalAlign;
}

export interface ShapeElement extends BaseElement {
  kind: "shape";
  shapeType: ShapeType;
  width: number;
  height: number;
  /** Stroke/fill color (hex). */
  color?: string;
  /** When true, filled with color; when false, outline stroke only. */
  filled?: boolean;
}

export type WhiteboardElement = TextElement | ShapeElement;
