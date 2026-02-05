export type ElementKind = "text";

export interface BaseElement {
  id: string;
  x: number;
  y: number;
  kind: ElementKind;
}

export interface TextElement extends BaseElement {
  kind: "text";
  content: string;
}

export type WhiteboardElement = TextElement;
