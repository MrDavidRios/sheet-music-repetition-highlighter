import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface PlaybackContextValue {
  playingPatternId: number | null;
  playingNotes: Set<string> | null;
  startPlayback: (patternId: number) => void;
  stopPlayback: () => void;
  setPlayingNotes: (keys: Set<string> | null) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [playingPatternId, setPlayingPatternId] = useState<number | null>(null);
  const [playingNotes, setPlayingNotesState] = useState<Set<string> | null>(null);

  const startPlayback = useCallback((patternId: number) => {
    setPlayingPatternId(patternId);
  }, []);

  const stopPlayback = useCallback(() => {
    setPlayingPatternId(null);
    setPlayingNotesState(null);
  }, []);

  const setPlayingNotes = useCallback((keys: Set<string> | null) => {
    setPlayingNotesState(keys);
    if (keys === null) {
      setPlayingPatternId(null);
    }
  }, []);

  return (
    <PlaybackContext.Provider
      value={{
        playingPatternId,
        playingNotes,
        startPlayback,
        stopPlayback,
        setPlayingNotes,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be within PlaybackProvider");
  return ctx;
}
