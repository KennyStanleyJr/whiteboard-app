import type { TextVerticalAlign } from "@/types/whiteboard";

export function verticalAlignToJustifyContent(
  va: TextVerticalAlign | undefined
): "flex-start" | "center" | "flex-end" {
  switch (va ?? "top") {
    case "top":
      return "flex-start";
    case "middle":
      return "center";
    case "bottom":
      return "flex-end";
  }
}
