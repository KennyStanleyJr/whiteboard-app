import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Upload, MoreVertical, Pencil, Trash2 } from "lucide-react";
import JSZip from "jszip";
import { AppMenu } from "./components/AppMenu";
import { WhiteboardCanvas } from "./components/WhiteboardCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  PortalContainerProvider,
  usePortalContainerRef,
} from "./contexts/PortalContainerContext";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { useSingleOpen } from "./hooks/useSingleOpen";
import { getWhiteboardQueryKey } from "./hooks/useWhiteboard";
import {
  getWhiteboard,
  getWhiteboardSync,
  setWhiteboard,
  type WhiteboardState,
} from "./api/whiteboard";
import type { GridStyle } from "./lib/canvasPreferences";
import { isCanvasBackgroundDark } from "./lib/contrastColor";
import {
  getBoards,
  getBoardsSync,
  getCurrentBoardId,
  setCurrentBoardId,
  addBoard,
  updateBoardName,
  deleteBoard,
  type Board,
  getCurrentBoardIdSync,
} from "./api/boards";
import {
  loadCanvasPreferences,
  saveCanvasPreference,
  type CanvasPreferences,
} from "./lib/canvasPreferences";
import { remapElementIdsForAppend } from "./lib/remapElementIds";
import "./App.css";

const MANAGEMENT_GRID_DOT_CLASS =
  "h-3 w-3 rounded-[3px] border-2 border-muted-foreground";

/**
 * Reducer: board list and current board.
 * Keeps boards (from API), currentBoardId, and boardName in sync for the management view.
 */
type BoardsState = { boards: Board[]; currentBoardId: string; boardName: string };
type BoardsAction =
  | { type: "SET_BOARDS"; payload: Board[] }
  | { type: "SET_CURRENT_BOARD"; payload: string }
  | { type: "SET_BOARD_NAME"; payload: string };

function boardsReducer(state: BoardsState, action: BoardsAction): BoardsState {
  switch (action.type) {
    case "SET_BOARDS":
      return { ...state, boards: action.payload };
    case "SET_CURRENT_BOARD":
      return { ...state, currentBoardId: action.payload };
    case "SET_BOARD_NAME":
      return { ...state, boardName: action.payload };
    default:
      return state;
  }
}

/**
 * Reducer: management view UI (rename inline, delete confirmation).
 * Per-board ⋮ menu open state is useSingleOpen so only one board menu is open at a time.
 */
type AppUiState = {
  renamingBoardId: string | null;
  renameValue: string;
  deleteDialogOpen: boolean;
  boardToDelete: string | null;
};
type AppUiAction =
  | { type: "START_RENAME"; payload: { boardId: string; currentName: string } }
  | { type: "CANCEL_RENAME" }
  | { type: "SET_RENAME_VALUE"; payload: string }
  | { type: "CLEAR_RENAME" }
  | { type: "OPEN_DELETE_DIALOG"; payload: string }
  | { type: "CLOSE_DELETE_DIALOG" };

function appUiReducer(state: AppUiState, action: AppUiAction): AppUiState {
  switch (action.type) {
    case "START_RENAME":
      return {
        ...state,
        renamingBoardId: action.payload.boardId,
        renameValue: action.payload.currentName,
      };
    case "CANCEL_RENAME":
      return {
        ...state,
        renamingBoardId: null,
        renameValue: "",
      };
    case "SET_RENAME_VALUE":
      return { ...state, renameValue: action.payload };
    case "CLEAR_RENAME":
      return { ...state, renamingBoardId: null, renameValue: "" };
    case "OPEN_DELETE_DIALOG":
      return {
        ...state,
        boardToDelete: action.payload,
        deleteDialogOpen: true,
      };
    case "CLOSE_DELETE_DIALOG":
      return {
        ...state,
        deleteDialogOpen: false,
        boardToDelete: null,
      };
    default:
      return state;
  }
}

const INITIAL_APP_UI: AppUiState = {
  renamingBoardId: null,
  renameValue: "",
  deleteDialogOpen: false,
  boardToDelete: null,
};

/** Reducer: app-wide canvas preferences (e.g. theme). Persisted via saveCanvasPreference. */
type PrefsAction = { type: "SET"; payload: CanvasPreferences } | { type: "UPDATE"; payload: Partial<CanvasPreferences> };
function prefsReducer(state: CanvasPreferences, action: PrefsAction): CanvasPreferences {
  switch (action.type) {
    case "SET":
      return action.payload;
    case "UPDATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

function App(): JSX.Element {
  const [portalContainerRef, portalContainer] = usePortalContainerRef();
  /** View is driven by hash (#/manage = management); sync on hashchange. */
  const [view, setView] = useState<"canvas" | "manage">(() =>
    typeof window !== "undefined" && window.location.hash === "#/manage"
      ? "manage"
      : "canvas"
  );
  // Sync init from storage so canvas can render immediately without waiting for API
  const initialBoards = getBoardsSync();
  const initialBoardId = getCurrentBoardIdSync();
  const initialBoard = initialBoards.find((b) => b.id === initialBoardId) ?? initialBoards[0];
  const [boardsState, dispatchBoards] = useReducer(boardsReducer, {
    boards: initialBoards,
    currentBoardId: initialBoard?.id ?? initialBoardId,
    boardName: initialBoard?.name ?? "Whiteboard",
  });
  const { boards, currentBoardId, boardName } = boardsState;
  const [openMenuId, boardMenuActions] = useSingleOpen<string>(null);
  const [appUi, dispatchAppUi] = useReducer(appUiReducer, INITIAL_APP_UI);
  const {
    renamingBoardId,
    renameValue,
    deleteDialogOpen,
    boardToDelete,
  } = appUi;
  const [canvasPreferences, dispatchPrefs] = useReducer(
    prefsReducer,
    undefined,
    loadCanvasPreferences
  );
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const renameInputRef = useRef<HTMLInputElement>(null);

  const setCanvasPreference = <K extends keyof CanvasPreferences>(
    key: K,
    value: CanvasPreferences[K]
  ): void => {
    dispatchPrefs({ type: "UPDATE", payload: { [key]: value } });
    saveCanvasPreference(key, value);
  };

  const { data: whiteboardData } = useQuery({
    queryKey: getWhiteboardQueryKey(currentBoardId),
    queryFn: () => getWhiteboard(currentBoardId),
    initialData: () => getWhiteboardSync(currentBoardId),
  });

  const boardBackgroundColor =
    whiteboardData?.backgroundColor != null &&
    /^#[0-9A-Fa-f]{6}$/.test(whiteboardData.backgroundColor)
      ? whiteboardData.backgroundColor
      : "#ffffff";
  const boardGridStyle: GridStyle =
    whiteboardData?.gridStyle === "empty" ||
    whiteboardData?.gridStyle === "dotted" ||
    whiteboardData?.gridStyle === "lined" ||
    whiteboardData?.gridStyle === "grid-lined"
      ? whiteboardData.gridStyle
      : "dotted";

  // Viewport (top bar on mobile, safe area): match whiteboard on canvas, theme on management. No animation.
  const MANAGEMENT_DARK_BG = "oklch(0.145 0 0)"; // must match .dark --color-background in index.css
  const MANAGEMENT_LIGHT_BG = "#f5f5f5";
  useEffect(() => {
    const viewportColor =
      view === "manage"
        ? canvasPreferences.theme === "dark"
          ? MANAGEMENT_DARK_BG
          : MANAGEMENT_LIGHT_BG
        : boardBackgroundColor;
    document.documentElement.style.backgroundColor = viewportColor;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", viewportColor);
  }, [view, canvasPreferences.theme, boardBackgroundColor]);

  const updateCurrentBoardAppearance = (partial: {
    backgroundColor?: string;
    gridStyle?: GridStyle;
  }): void => {
    const queryKey = getWhiteboardQueryKey(currentBoardId);
    const current = queryClient.getQueryData<WhiteboardState>(queryKey);
    if (current == null) return;
    const next: WhiteboardState = {
      ...current,
      ...(partial.backgroundColor != null && { backgroundColor: partial.backgroundColor }),
      ...(partial.gridStyle != null && { gridStyle: partial.gridStyle }),
    };
    queryClient.setQueryData(queryKey, next);
    setWhiteboard(next, currentBoardId).catch((err) => {
      console.error("[App] Update board appearance failed", err);
    });
  };

  // Load boards and current board
  useEffect(() => {
    const loadBoards = async (): Promise<void> => {
      let loadedBoards = await getBoards();
      // Ensure at least one board exists
      if (loadedBoards.length === 0) {
        const defaultBoard = await addBoard("Whiteboard");
        loadedBoards = [defaultBoard];
      }
      const currentId = await getCurrentBoardId();
      // Ensure current board ID is valid
      const firstBoard = loadedBoards[0];
      let validCurrentId: string;
      if (firstBoard != null && loadedBoards.some((b) => b.id === currentId)) {
        validCurrentId = currentId;
      } else if (firstBoard != null) {
        validCurrentId = firstBoard.id;
      } else {
        // This should never happen since we ensure at least one board exists above
        const defaultBoard = await addBoard("Whiteboard");
        validCurrentId = defaultBoard.id;
      }
      if (validCurrentId !== currentId) {
        await setCurrentBoardId(validCurrentId);
      }
      dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
      dispatchBoards({ type: "SET_CURRENT_BOARD", payload: validCurrentId });
      const currentBoard = loadedBoards.find((b) => b.id === validCurrentId);
      if (currentBoard != null) {
        dispatchBoards({ type: "SET_BOARD_NAME", payload: currentBoard.name });
      } else {
        dispatchBoards({ type: "SET_BOARD_NAME", payload: "Whiteboard" });
      }
    };
    void loadBoards();
  }, []);

  // Keep board name in sync when current board or board list changes
  useEffect(() => {
    const currentBoard = boards.find((b) => b.id === currentBoardId);
    if (currentBoard != null) {
      dispatchBoards({ type: "SET_BOARD_NAME", payload: currentBoard.name });
    }
  }, [boards, currentBoardId]);

  // Close board menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (openMenuId != null) {
        const menuRef = menuRefs.current[openMenuId];
        if (menuRef != null && !menuRef.contains(e.target as Node)) {
          boardMenuActions.close();
        }
      }
    };

    if (openMenuId != null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [openMenuId, boardMenuActions]);

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renamingBoardId != null && renameInputRef.current != null) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingBoardId]);

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

  const openBoard = async (id: string): Promise<void> => {
    // Blur any focused elements before switching views to avoid aria-hidden warnings
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await setCurrentBoardId(id);
    dispatchBoards({ type: "SET_CURRENT_BOARD", payload: id });
    window.location.hash = "";
    const loadedBoards = await getBoards();
    dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
  };

  const handleCreateBoard = async (): Promise<void> => {
    const newBoard = await addBoard("New Whiteboard");
    await setWhiteboard({ elements: [] }, newBoard.id);
    const loadedBoards = await getBoards();
    dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
    await openBoard(newBoard.id);
  };

  const handleNameChange = (value: string): void => {
    dispatchBoards({ type: "SET_BOARD_NAME", payload: value });
  };

  const handleNameBlur = async (): Promise<void> => {
    const trimmed = boardName.trim();
    if (trimmed.length === 0) {
      const currentBoard = boards.find((b) => b.id === currentBoardId);
      if (currentBoard != null) {
        dispatchBoards({ type: "SET_BOARD_NAME", payload: currentBoard.name });
      }
      return;
    }
    if (trimmed !== boardName) {
      dispatchBoards({ type: "SET_BOARD_NAME", payload: trimmed });
    }
    await updateBoardName(currentBoardId, trimmed);
    const loadedBoards = await getBoards();
    dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      const currentBoard = boards.find((b) => b.id === currentBoardId);
      if (currentBoard != null) {
        dispatchBoards({ type: "SET_BOARD_NAME", payload: currentBoard.name });
      }
      e.currentTarget.blur();
    }
  };

  const handleDownload = (boardId?: string): WhiteboardState => {
    const id = boardId ?? currentBoardId;
    const queryKey = getWhiteboardQueryKey(id);
    const state =
      queryClient.getQueryData<WhiteboardState>(queryKey) ?? {
        elements: [],
      };
    return state;
  };

  const handleUpload = (
    state: WhiteboardState,
    targetBoardId?: string,
    options?: { mode?: "replace" | "append" }
  ): void => {
    const id = targetBoardId ?? currentBoardId;
    const queryKey = getWhiteboardQueryKey(id);
    const mode = options?.mode ?? "replace";
    if (mode === "append") {
      const current = getWhiteboardSync(id);
      const existingIds = new Set(current.elements.map((e) => e.id));
      const appended = remapElementIdsForAppend(existingIds, state.elements);
      const merged: WhiteboardState = {
        ...current,
        elements: [...current.elements, ...appended],
      };
      queryClient.setQueryData(queryKey, merged);
      setWhiteboard(merged, id).catch((err) => {
        console.error("[App] Upload append persist failed", err);
      });
    } else {
      queryClient.setQueryData(queryKey, state);
      setWhiteboard(state, id).catch((err) => {
        console.error("[App] Upload replace persist failed", err);
      });
    }
  };

  const handleDownloadBoard = (boardId?: string): void => {
    try {
      const id = boardId ?? currentBoardId;
      const state = handleDownload(id);
      const board = boards.find((b) => b.id === id);
      const boardName = board?.name ?? "whiteboard";
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate filename from board name
      const sanitizedName = boardName.replace(/[^a-z0-9]/gi, "-");
      const filename = `${sanitizedName}.json`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[App] Download board failed", err);
    }
  };

  const handleDownloadAll = async (): Promise<void> => {
    try {
      const zip = new JSZip();
      
      // Add each board as a separate JSON file, preserving order
      for (const board of boards) {
        const state = handleDownload(board.id);
        const json = JSON.stringify(state, null, 2);
        const sanitizedName = board.name.replace(/[^a-z0-9]/gi, "-");
        const filename = `${sanitizedName}.json`;
        zip.file(filename, json);
      }
      
      // Generate zip file with preserved order
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "whiteboards.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[App] Download all boards failed", err);
    }
  };

  const handleMenuToggle = (boardId: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    boardMenuActions.toggle(boardId);
  };

  const handleRenameStart = (boardId: string, currentName: string): void => {
    boardMenuActions.close();
    dispatchAppUi({
      type: "START_RENAME",
      payload: { boardId, currentName },
    });
  };

  const handleRenameCancel = (): void => {
    dispatchAppUi({ type: "CANCEL_RENAME" });
  };

  const handleRenameSubmit = async (boardId: string): Promise<void> => {
    const trimmed = renameValue.trim();
    if (trimmed.length === 0) {
      handleRenameCancel();
      return;
    }
    await updateBoardName(boardId, trimmed);
    const loadedBoards = await getBoards();
    dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
    if (boardId === currentBoardId) {
      dispatchBoards({ type: "SET_BOARD_NAME", payload: trimmed });
    }
    dispatchAppUi({ type: "CLEAR_RENAME" });
  };

  const handleRenameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    boardId: string
  ): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleRenameSubmit(boardId);
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  const handleDeleteClick = (boardId: string): void => {
    boardMenuActions.close();
    dispatchAppUi({ type: "OPEN_DELETE_DIALOG", payload: boardId });
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (boardToDelete == null) return;
    const boardId = boardToDelete;
    dispatchAppUi({ type: "CLOSE_DELETE_DIALOG" });
    const wasCurrentBoard = boardId === currentBoardId;
    await deleteBoard(boardId);
    const deletedBoardQueryKey = getWhiteboardQueryKey(boardId);
    queryClient.removeQueries({ queryKey: deletedBoardQueryKey });
    const loadedBoards = await getBoards();
    dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
    const currentId = await getCurrentBoardId();
    dispatchBoards({ type: "SET_CURRENT_BOARD", payload: currentId });
    const currentBoard = loadedBoards.find((b) => b.id === currentId);
    if (currentBoard != null) {
      dispatchBoards({ type: "SET_BOARD_NAME", payload: currentBoard.name });
    }
    if (wasCurrentBoard && currentId !== boardId) {
      await setCurrentBoardId(currentId);
    }
  };

  const handleDeleteCancel = (): void => {
    dispatchAppUi({ type: "CLOSE_DELETE_DIALOG" });
  };

  /**
   * Validate and sanitize panZoom state if present.
   */
  const validatePanZoom = (state: WhiteboardState): void => {
    if (state.panZoom == null) return;
    const pz = state.panZoom;
    if (
      typeof pz.panX !== "number" ||
      typeof pz.panY !== "number" ||
      typeof pz.zoom !== "number" ||
      !Number.isFinite(pz.panX) ||
      !Number.isFinite(pz.panY) ||
      !Number.isFinite(pz.zoom) ||
      pz.zoom <= 0
    ) {
      state.panZoom = undefined;
    }
  };

  /**
   * Parse JSON text into WhiteboardState, returning null if invalid.
   */
  const parseWhiteboardState = (text: string): WhiteboardState | null => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (
        parsed != null &&
        typeof parsed === "object" &&
        Array.isArray((parsed as WhiteboardState).elements)
      ) {
        const state = parsed as WhiteboardState;
        validatePanZoom(state);
        return state;
      }
    } catch {
      /* invalid JSON */
    }
    return null;
  };

  /**
   * Create a new board and upload state into it.
   */
  const processWhiteboardState = async (
    state: WhiteboardState,
    boardName: string
  ): Promise<string | null> => {
    validatePanZoom(state);
    const newBoard = await addBoard(boardName);
    handleUpload(state, newBoard.id);
    return newBoard.id;
  };

  /**
   * Process a ZIP file and upload all JSON whiteboards from it.
   */
  const processZipFile = async (
    file: File
  ): Promise<string | null> => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Collect JSON files in order
    const jsonFiles: Array<{ path: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, zipFile) => {
      if (!zipFile.dir && relativePath.toLowerCase().endsWith(".json")) {
        jsonFiles.push({ path: relativePath, file: zipFile });
      }
    });
    
    // Process each JSON file in the ZIP, preserving order
    let lastBoardId: string | null = null;
    for (const { path: relativePath, file: zipFile } of jsonFiles) {
      const text = await zipFile.async("string");
      const state = parseWhiteboardState(text);
      if (state != null) {
        const boardName = relativePath.replace(/\.json$/i, "").replace(/.*\//, "") || "Uploaded Whiteboard";
        const boardId = await processWhiteboardState(state, boardName);
        if (boardId != null) {
          lastBoardId = boardId;
        }
      }
    }
    return lastBoardId;
  };

  /**
   * Process an individual JSON file and upload it.
   */
  const processJsonFile = async (
    file: File
  ): Promise<string | null> => {
    const text = await file.text();
    const state = parseWhiteboardState(text);
    if (state == null) return null;
    const boardName = file.name.replace(/\.json$/i, "") || "Uploaded Whiteboard";
    return await processWhiteboardState(state, boardName);
  };

  const handleUploadClick = (): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.zip";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files == null || files.length === 0) return;

      try {
        let lastUploadedBoardId: string | null = null;
        let uploadedJsonFileCount = 0;
        let hasZipFile = false;
        
        // Process files in selection order (FileList order)
        // Note: Some browsers may return files in reverse selection order, so we reverse to match user expectation
        const filesArray = Array.from(files).reverse();
        for (const file of filesArray) {
          if (file.name.toLowerCase().endsWith(".zip")) {
            hasZipFile = true;
            const boardId = await processZipFile(file);
            if (boardId != null) {
              lastUploadedBoardId = boardId;
            }
          } else {
            const boardId = await processJsonFile(file);
            if (boardId != null) {
              uploadedJsonFileCount += 1;
              lastUploadedBoardId = boardId;
            }
          }
        }
        const loadedBoards = await getBoards();
        dispatchBoards({ type: "SET_BOARDS", payload: loadedBoards });
        // Only open the board if exactly one individual JSON file was uploaded (not ZIP, not multiple files)
        if (lastUploadedBoardId != null && !hasZipFile && uploadedJsonFileCount === 1) {
          await openBoard(lastUploadedBoardId);
        }
      } catch (err) {
        console.error("[App] Upload failed", err);
      }
    };
    input.click();
  };

  return (
    <PortalContainerProvider container={portalContainer}>
      <ThemeProvider theme={canvasPreferences.theme}>
      <div
        ref={portalContainerRef}
        className={cn(
          "flex h-full flex-col overflow-hidden relative",
          canvasPreferences.theme === "dark" && "dark"
        )}
      >
      <header
        className="app-header fixed left-5 top-3 right-5 flex items-center justify-between gap-4"
        data-header-contrast={
          view === "manage"
            ? canvasPreferences.theme === "dark"
              ? "light"
              : "dark"
            : isCanvasBackgroundDark(boardBackgroundColor)
              ? "light"
              : "dark"
        }
      >
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="management-toggle-button size-[50px] rounded-lg font-semibold shadow-none"
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
          <Input
            ref={nameInputRef}
            type="text"
            value={boardName || "Whiteboard"}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => void handleNameBlur()}
            onKeyDown={handleNameKeyDown}
            className="text-lg font-semibold leading-tight border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto w-[150px] truncate header-input"
            placeholder="Whiteboard name"
          />
        </div>
        {view !== "manage" && (
          <AppMenu
            onUpload={(state, options) => handleUpload(state, undefined, options)}
            onDownload={() => handleDownload()}
            currentBoardName={boardName ?? "Whiteboard"}
            boardBackgroundColor={boardBackgroundColor}
            boardGridStyle={boardGridStyle}
            onBoardAppearanceChange={updateCurrentBoardAppearance}
            canvasPreferences={canvasPreferences}
            onCanvasPreferenceChange={setCanvasPreference}
          />
        )}
      </header>
      <WhiteboardCanvas key={currentBoardId} boardId={currentBoardId} />
      <main
        className={cn(
          "app-overlay flex flex-col justify-start items-center md:items-start px-5 md:px-20 pt-16 pb-6 box-border bg-background overflow-visible",
          "opacity-0 pointer-events-none invisible",
          view === "manage" && "opacity-100 pointer-events-auto visible",
          view === "manage" && canvasPreferences.theme === "dark" && "dark"
        )}
        aria-hidden={view !== "manage"}
      >
        <div className="flex flex-col md:flex-row gap-3 mt-8 mb-6 justify-center items-center md:justify-start overflow-visible w-full md:w-auto" role="toolbar">
          <Button
            type="button"
            variant="default"
            className="management-new-board-btn flex items-center gap-2 w-full md:w-[168px] min-w-[168px]"
            onClick={() => void handleCreateBoard()}
            aria-label="Create new whiteboard"
          >
            <Plus aria-hidden className="size-4" />
            <span>New Whiteboard</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="management-upload-download-btn border-border flex items-center gap-2 w-full md:w-[168px] min-w-[168px]"
            onClick={handleUploadClick}
            aria-label="Upload whiteboard(s) from file(s)"
          >
            <Upload aria-hidden className="size-4" />
            <span>Upload</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="management-upload-download-btn border-border flex items-center gap-2 w-full md:w-[168px] min-w-[168px]"
            onClick={() => void handleDownloadAll()}
            aria-label="Download all whiteboards"
            disabled={boards.length === 0}
          >
            <Download aria-hidden className="size-4" />
            <span>Download All</span>
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 justify-center md:justify-start overflow-visible w-full" role="list">
          {boards.map((board) => (
            <div key={board.id} className="board-card-wrapper">
              <div
                className={cn(
                  "relative flex h-[168px] w-[168px] flex-col rounded-xl border shadow-sm transition-all p-1 bg-card",
                  board.id === currentBoardId
                    ? "border-primary"
                    : "border-border"
                )}
              >
              {renamingBoardId === board.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 flex flex-col items-center justify-center p-4 text-center focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2 whitespace-normal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) =>
                      dispatchAppUi({
                        type: "SET_RENAME_VALUE",
                        payload: e.target.value,
                      })
                    }
                    onBlur={() => void handleRenameSubmit(board.id)}
                    onKeyDown={(e) => handleRenameKeyDown(e, board.id)}
                    className="font-semibold text-base text-foreground break-words line-clamp-3 w-full min-w-0 text-center border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 flex flex-col items-center justify-center p-4 text-center focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2 whitespace-normal"
                  onClick={() => void openBoard(board.id)}
                >
                  <span className="font-semibold text-base text-foreground break-words line-clamp-3 w-full min-w-0">
                    {board.name}
                  </span>
                </Button>
              )}
              <div
                ref={(el) => {
                  menuRefs.current[board.id] = el;
                }}
                className="absolute top-2 right-2"
              >
                <div className="group flex size-7 items-center justify-center rounded-md hover:bg-[var(--card-menu-button-hover-bg)]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded [&_svg]:size-4 !bg-transparent hover:!bg-transparent group-hover:!text-[var(--toolbar-hover-fg)]"
                    aria-label={`Menu for ${board.name}`}
                    aria-expanded={openMenuId === board.id}
                    aria-haspopup="menu"
                    onClick={(e) => handleMenuToggle(board.id, e)}
                  >
                    <MoreVertical aria-hidden />
                  </Button>
                </div>
                {openMenuId === board.id && (
                  <div
                    className="absolute right-0 top-full z-[60] mt-1 flex flex-col gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-md min-w-[160px]"
                    role="menu"
                    aria-label={`Options for ${board.name}`}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-full justify-start gap-2 px-3 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadBoard(board.id);
                        boardMenuActions.close();
                      }}
                      role="menuitem"
                      aria-label={`Download ${board.name}`}
                    >
                      <Download aria-hidden className="size-4" />
                      <span>Download</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-full justify-start gap-2 px-3 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameStart(board.id, board.name);
                      }}
                      role="menuitem"
                      aria-label={`Rename ${board.name}`}
                    >
                      <Pencil aria-hidden className="size-4" />
                      <span>Rename</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="destructive-menu-item h-9 w-full justify-start gap-2 px-3 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(board.id);
                      }}
                      role="menuitem"
                      aria-label={`Delete ${board.name}`}
                      disabled={boards.length === 1}
                    >
                      <Trash2 aria-hidden className="size-4" />
                      <span>Delete</span>
                    </Button>
                  </div>
                )}
              </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleDeleteCancel();
        }
      }}>
        <DialogContent
          className={cn(
            "delete-whiteboard-dialog max-w-sm overflow-hidden bg-background text-foreground border-border",
            canvasPreferences.theme === "dark" && "dark"
          )}
        >
          <DialogHeader>
            <DialogTitle className="delete-whiteboard-dialog__title text-foreground">
              Delete Whiteboard
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{boards.find((b) => b.id === boardToDelete)?.name ?? "this whiteboard"}"?
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="min-w-0 flex flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              className="delete-whiteboard-dialog__cancel min-w-0 shrink-0 w-full"
              onClick={handleDeleteCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="delete-whiteboard-dialog__confirm min-w-0 shrink-0 w-full"
              onClick={() => void handleDeleteConfirm()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      </ThemeProvider>
    </PortalContainerProvider>
  );
}

export default App;
