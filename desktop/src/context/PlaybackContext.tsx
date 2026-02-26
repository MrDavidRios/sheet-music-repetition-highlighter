import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface PlaybackContextValue {
  playingPatternId: number | null;
  playingBeatIndex: number | null;
  startPlayback: (patternId: number) => void;
  stopPlayback: () => void;
  setPlayingBeatIndex: (index: number | null) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [playingPatternId, setPlayingPatternId] = useState<number | null>(null);
  const [playingBeatIndex, setPlayingBeatIndexState] = useState<number | null>(null);

  const startPlayback = useCallback((patternId: number) => {
    setPlayingPatternId(patternId);
  }, []);

  const stopPlayback = useCallback(() => {
    setPlayingPatternId(null);
    setPlayingBeatIndexState(null);
  }, []);

  const setPlayingBeatIndex = useCallback((index: number | null) => {
    setPlayingBeatIndexState(index);
    if (index === null) {
      setPlayingPatternId(null);
    }
  }, []);

  return (
    <PlaybackContext.Provider
      value={{
        playingPatternId,
        playingBeatIndex,
        startPlayback,
        stopPlayback,
        setPlayingBeatIndex,
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
