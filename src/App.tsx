import { useEffect, useState, useRef } from "react";
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
import { remapElementIdsForAppend } from "./utils/remapElementIds";
import "./App.css";

const MANAGEMENT_GRID_DOT_CLASS =
  "h-3 w-3 rounded-[3px] border-2 border-muted-foreground";

function App(): JSX.Element {
  const [portalContainerRef, portalContainer] = usePortalContainerRef();
  const [view, setView] = useState<"canvas" | "manage">("canvas");
  // Initialize boards synchronously to ensure canvas can render immediately
  const initialBoards = getBoardsSync();
  const initialBoardId = getCurrentBoardIdSync();
  const initialBoard = initialBoards.find((b) => b.id === initialBoardId) ?? initialBoards[0];
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [currentBoardId, setCurrentBoardIdState] = useState<string>(
    initialBoard?.id ?? initialBoardId
  );
  const [boardName, setBoardName] = useState<string>(initialBoard?.name ?? "Whiteboard");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [boardToDelete, setBoardToDelete] = useState<string | null>(null);
  const [canvasPreferences, setCanvasPreferences] = useState<CanvasPreferences>(
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
    setCanvasPreferences((prev) => ({ ...prev, [key]: value }));
    saveCanvasPreference(key, value);
  };

  // Sync theme-color meta for mobile browser chrome (address bar, status bar) with app theme.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const isDark = canvasPreferences.theme === "dark";
    meta.setAttribute("content", isDark ? "#252525" : "#f5f5f5");
  }, [canvasPreferences.theme]);

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
      setBoards(loadedBoards);
      setCurrentBoardIdState(validCurrentId);
      const currentBoard = loadedBoards.find((b) => b.id === validCurrentId);
      if (currentBoard != null) {
        setBoardName(currentBoard.name);
      } else {
        setBoardName("Whiteboard");
      }
    };
    void loadBoards();
  }, []);

  // Update board name when current board changes
  useEffect(() => {
    const currentBoard = boards.find((b) => b.id === currentBoardId);
    if (currentBoard != null) {
      setBoardName(currentBoard.name);
    }
  }, [boards, currentBoardId]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (openMenuId != null) {
        const menuRef = menuRefs.current[openMenuId];
        if (menuRef != null && !menuRef.contains(e.target as Node)) {
          setOpenMenuId(null);
        }
      }
    };

    if (openMenuId != null) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [openMenuId]);

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
    setCurrentBoardIdState(id);
    window.location.hash = "";
    // Reload boards to get updated names
    const loadedBoards = await getBoards();
    setBoards(loadedBoards);
  };

  const handleCreateBoard = async (): Promise<void> => {
    const newBoard = await addBoard("New Whiteboard");
    // Initialize new board with empty state
    await setWhiteboard({ elements: [] }, newBoard.id);
    const loadedBoards = await getBoards();
    setBoards(loadedBoards);
    await openBoard(newBoard.id);
  };

  const handleNameChange = (value: string): void => {
    setBoardName(value);
  };

  const handleNameBlur = async (): Promise<void> => {
    const trimmed = boardName.trim();
    if (trimmed.length === 0) {
      // Restore original name if empty
      const currentBoard = boards.find((b) => b.id === currentBoardId);
      if (currentBoard != null) {
        setBoardName(currentBoard.name);
      }
      return;
    }
    if (trimmed !== boardName) {
      setBoardName(trimmed);
    }
    await updateBoardName(currentBoardId, trimmed);
    // Reload boards to get updated names
    const loadedBoards = await getBoards();
    setBoards(loadedBoards);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      const currentBoard = boards.find((b) => b.id === currentBoardId);
      if (currentBoard != null) {
        setBoardName(currentBoard.name);
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
    setOpenMenuId(openMenuId === boardId ? null : boardId);
  };

  const handleRenameStart = (boardId: string, currentName: string): void => {
    setRenamingBoardId(boardId);
    setRenameValue(currentName);
    setOpenMenuId(null);
  };

  const handleRenameCancel = (): void => {
    setRenamingBoardId(null);
    setRenameValue("");
  };

  const handleRenameSubmit = async (boardId: string): Promise<void> => {
    const trimmed = renameValue.trim();
    if (trimmed.length === 0) {
      handleRenameCancel();
      return;
    }
    await updateBoardName(boardId, trimmed);
    const loadedBoards = await getBoards();
    setBoards(loadedBoards);
    // Update current board name if it's the renamed board
    if (boardId === currentBoardId) {
      setBoardName(trimmed);
    }
    setRenamingBoardId(null);
    setRenameValue("");
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
    setOpenMenuId(null);
    setBoardToDelete(boardId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (boardToDelete == null) return;
    
    const boardId = boardToDelete;
    setDeleteDialogOpen(false);
    const wasCurrentBoard = boardId === currentBoardId;
    await deleteBoard(boardId);
    // Invalidate React Query cache for the deleted board
    const deletedBoardQueryKey = getWhiteboardQueryKey(boardId);
    queryClient.removeQueries({ queryKey: deletedBoardQueryKey });
    const loadedBoards = await getBoards();
    setBoards(loadedBoards);
    // Update current board ID if deleted board was current
    const currentId = await getCurrentBoardId();
    setCurrentBoardIdState(currentId);
    const currentBoard = loadedBoards.find((b) => b.id === currentId);
    if (currentBoard != null) {
      setBoardName(currentBoard.name);
    }
    // If we deleted the current board, persist the new current board (stay on management page)
    if (wasCurrentBoard && currentId !== boardId) {
      await setCurrentBoardId(currentId);
    }
    setBoardToDelete(null);
  };

  const handleDeleteCancel = (): void => {
    setDeleteDialogOpen(false);
    setBoardToDelete(null);
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
        // Reload boards and refresh view
        const loadedBoards = await getBoards();
        setBoards(loadedBoards);
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
          view === "manage" && "opacity-100 pointer-events-auto visible"
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
                    onChange={(e) => setRenameValue(e.target.value)}
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
                        setOpenMenuId(null);
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
