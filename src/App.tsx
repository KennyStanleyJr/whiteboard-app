import { useEffect, useState } from "react";
import { WhiteboardCanvas } from "./components/WhiteboardCanvas";
import "./App.css";

type AppView = "canvas" | "manage";
type Board = { id: string; name: string };

function App(): JSX.Element {
  const [view, setView] = useState<AppView>("canvas");
  const boards: Board[] = [{ id: "board-1", name: "Whiteboard" }];

  useEffect(() => {
    const applyHashView = (): void => {
      setView(window.location.hash === "#/manage" ? "manage" : "canvas");
    };

    applyHashView();
    window.addEventListener("hashchange", applyHashView);
    return () => window.removeEventListener("hashchange", applyHashView);
  }, []);

  const toggleView = (): void => {
    window.location.hash = view === "manage" ? "" : "#/manage";
  };

  const handleBoardSelect = (id: string): void => {
    console.log(`Open board ${id}`);
    window.location.hash = "";
  };

  const handleCreateBoard = (): void => {
    console.log("Create new board");
  };

  return (
    <div className="app">
      <header className="app-header">
        <button
          type="button"
          className="app-header-badge"
          aria-label={
            view === "manage"
              ? "Close whiteboard management"
              : "Open whiteboard management"
          }
          onClick={toggleView}
          >
          <span className="app-header-icon" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        </button>
        <h1 className="app-header-title">Whiteboard</h1>
      </header>
      <WhiteboardCanvas />
      <main
        className={`management-page ${
          view === "manage" ? "is-open" : "is-closed"
        }`}
        aria-hidden={view !== "manage"}
      >
        <div className="board-grid" role="list">
          <button
            type="button"
            className="board-card board-card-new"
            role="listitem"
            aria-label="Create new whiteboard"
            onClick={handleCreateBoard}
          >
            <span aria-hidden="true" className="board-card-plus">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="board-card-title">New board</span>
          </button>
          {boards.map((board) => (
            <button
              key={board.id}
              type="button"
              className="board-card"
              role="listitem"
              onClick={() => handleBoardSelect(board.id)}
            >
              <span className="board-card-title">{board.name}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
