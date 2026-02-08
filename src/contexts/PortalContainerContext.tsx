/* eslint-disable react-refresh/only-export-components -- context + hooks in one place for portal container */
import { createContext, useContext, useState, useCallback } from "react";

const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}

export function PortalContainerProvider({
  children,
  container,
}: {
  children: React.ReactNode;
  container: HTMLElement | null;
}): JSX.Element {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  );
}

/**
 * Returns a callback ref and the current element.
 * Use the ref on the node that should host portaled content (e.g. for theme/stacking).
 * Container is null until the node is mounted and when it unmounts.
 */
export function usePortalContainerRef(): [
  (el: HTMLDivElement | null) => void,
  HTMLElement | null,
] {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const setRef = useCallback((el: HTMLDivElement | null) => {
    setContainer(el);
  }, []);
  return [setRef, container];
}
