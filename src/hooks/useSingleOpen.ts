import { useCallback, useMemo, useReducer } from "react";

/**
 * Reducer: at most one item of type T is "open" at a time (e.g. one submenu, one picker).
 * OPEN sets explicitly; TOGGLE opens the id if closed, closes if it's already open.
 */
type SingleOpenAction<T> =
  | { type: "OPEN"; payload: T | null }
  | { type: "TOGGLE"; payload: T };

function singleOpenReducer<T>(
  state: T | null,
  action: SingleOpenAction<T>
): T | null {
  switch (action.type) {
    case "OPEN":
      return action.payload;
    case "TOGGLE":
      return state === action.payload ? null : action.payload;
    default:
      return state;
  }
}

/**
 * Shared "single open menu" state: only one of a set of options can be open at a time.
 * Use for toolbars (one submenu open), app menu (one picker open), etc.
 *
 * @param initial - Initial open id, or null for none
 * @returns [current open id, { open, close, toggle, isOpen }]
 */
export function useSingleOpen<T>(
  initial: T | null = null
): [
  T | null,
  {
    open: (id: T | null) => void;
    close: () => void;
    toggle: (id: T) => void;
    isOpen: (id: T) => boolean;
  },
] {
  const [value, dispatch] = useReducer(singleOpenReducer<T>, initial);

  const open = useCallback((id: T | null) => {
    dispatch({ type: "OPEN", payload: id });
  }, []);

  const close = useCallback(() => {
    dispatch({ type: "OPEN", payload: null });
  }, []);

  const toggle = useCallback((id: T) => {
    dispatch({ type: "TOGGLE", payload: id });
  }, []);

  const isOpen = useCallback(
    (id: T) => value === id,
    [value]
  );

  const actions = useMemo(
    () => ({ open, close, toggle, isOpen }),
    [open, close, toggle, isOpen]
  );
  return [value, actions];
}
