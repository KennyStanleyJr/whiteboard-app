import { useEffect, useState } from "react";
import { WhiteboardCanvas } from "./components/WhiteboardCanvas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "./App.css";

const BOARDS = [{ id: "board-1", name: "Whiteboard" }] as const;

const MANAGEMENT_GRID_DOT_CLASS =
  "h-3 w-3 rounded-[3px] border-2 border-muted-foreground";

function App(): JSX.Element {
  const [view, setView] = useState<"canvas" | "manage">("canvas");

  useEffect(() => {
    const sync = (): void =>
      setView(window.location.hash === "#/manage" ? "manage" : "canvas");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const toggleView = (): void => {
    window.location.hash = view === "manage" ? "" : "#/manage";
  };

  const openBoard = (id: string): void => {
    console.log(`Open board ${id}`);
    window.location.hash = "";
  };

  return (
    <div className="flex h-full flex-col overflow-hidden relative">
      <header className="app-header fixed left-5 top-3 flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="management-toggle-button size-[50px] rounded-lg font-semibold text-foreground shadow-none"
          aria-label={
            view === "manage"
              ? "Close whiteboard management"
              : "Open whiteboard management"
          }
          onClick={toggleView}
        >
          <span className="grid grid-cols-2 grid-rows-2 gap-1 p-1" aria-hidden>
            <span className={MANAGEMENT_GRID_DOT_CLASS} />
            <span className={MANAGEMENT_GRID_DOT_CLASS} />
            <span className={MANAGEMENT_GRID_DOT_CLASS} />
            <span className={MANAGEMENT_GRID_DOT_CLASS} />
          </span>
        </Button>
        <h1 className="text-lg font-semibold leading-tight text-foreground">
          Whiteboard
        </h1>
      </header>
      <WhiteboardCanvas />
      <main
        className={cn(
          "app-overlay flex justify-start p-16 pt-16 pb-6 box-border bg-background",
          "opacity-0 pointer-events-none invisible",
          view === "manage" && "opacity-100 pointer-events-auto visible"
        )}
        aria-hidden={view !== "manage"}
      >
        <div className="mt-4 flex flex-wrap gap-3 justify-start" role="list">
          <Button
            type="button"
            variant="outline"
            className="relative flex h-[168px] w-[168px] flex-col items-center justify-center gap-2 rounded-xl border-dashed bg-gradient-to-b from-background to-muted/30 p-4 text-center shadow-sm transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2"
            role="listitem"
            aria-label="Create new whiteboard"
            onClick={() => console.log("Create new board")}
          >
            <span className="inline-flex items-center justify-center leading-none text-muted-foreground">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="font-semibold text-base text-foreground">
              New board
            </span>
          </Button>
          {BOARDS.map((board) => (
            <Button
              key={board.id}
              type="button"
              variant="outline"
              className="relative flex h-[168px] w-[168px] flex-col items-center justify-center rounded-xl border-border bg-gradient-to-b from-card to-muted/20 p-4 text-center shadow-sm transition-all hover:border-border hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2"
              role="listitem"
              onClick={() => openBoard(board.id)}
            >
              <span className="font-semibold text-base text-foreground">
                {board.name}
              </span>
            </Button>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
