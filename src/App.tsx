import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { WhiteboardCanvas } from "./components/WhiteboardCanvas";
import { Button } from "@/components/ui/button";
import { AppMenu } from "./components/AppMenu";
import { cn } from "@/lib/utils";
import { WHITEBOARD_QUERY_KEY } from "./hooks/useWhiteboard";
import { setWhiteboard, type WhiteboardState } from "./api/whiteboard";
import "./App.css";

const BOARDS = [{ id: "board-1", name: "Whiteboard" }] as const;

const MANAGEMENT_GRID_DOT_CLASS =
  "h-3 w-3 rounded-[3px] border-2 border-muted-foreground";

function App(): JSX.Element {
  const [view, setView] = useState<"canvas" | "manage">("canvas");
  const queryClient = useQueryClient();

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

  const handleDownload = (): WhiteboardState => {
    const state =
      queryClient.getQueryData<WhiteboardState>(WHITEBOARD_QUERY_KEY) ?? {
        elements: [],
      };
    return state;
  };

  const handleImport = (state: WhiteboardState): void => {
    queryClient.setQueryData(WHITEBOARD_QUERY_KEY, state);
    setWhiteboard(state).catch((err) => {
      console.error("[App] Import persist failed", err);
    });
  };

  const handleDownloadBoard = (): void => {
    try {
      const state = handleDownload();
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Generate readable filename: whiteboard-YYYY-MM-DD-HH-MM-SS.txt
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const filename = `whiteboard-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.txt`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[App] Download board failed", err);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden relative">
      <header className="app-header fixed left-5 top-3 right-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
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
        </div>
        {view !== "manage" && (
          <AppMenu onImport={handleImport} onDownload={handleDownload} />
        )}
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
            <div
              key={board.id}
              className="relative flex h-[168px] w-[168px] flex-col rounded-xl border border-border bg-gradient-to-b from-card to-muted/20 shadow-sm transition-all hover:border-border hover:shadow-md hover:-translate-y-0.5"
            >
              <Button
                type="button"
                variant="ghost"
                className="flex-1 flex flex-col items-center justify-center p-4 text-center focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2"
                onClick={() => openBoard(board.id)}
              >
                <span className="font-semibold text-base text-foreground">
                  {board.name}
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 rounded [&_svg]:size-4"
                aria-label="Download whiteboard"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadBoard();
                }}
              >
                <Download aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
