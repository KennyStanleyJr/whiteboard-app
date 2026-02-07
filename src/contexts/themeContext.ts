import { createContext, useContext } from "react";
import type { Theme } from "@/lib/canvasPreferences";

export const ThemeContext = createContext<Theme>("light");

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
