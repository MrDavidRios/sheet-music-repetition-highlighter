import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

const TEMPO_STORAGE_KEY = "smrh_tempo";

interface PlaybackContextValue {
  playingPatternId: number | null;
  playingBeatIndex: number | null;
  tempo: number;
  setTempo: (tempo: number) => void;
  startPlayback: (patternId: number) => void;
  stopPlayback: () => void;
  setPlayingBeatIndex: (index: number | null) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

function loadSavedTempo(): number {
  const saved = localStorage.getItem(TEMPO_STORAGE_KEY);
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 300) return parsed;
  }
  return 120;
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [playingPatternId, setPlayingPatternId] = useState<number | null>(null);
  const [playingBeatIndex, setPlayingBeatIndexState] = useState<number | null>(null);
  const [tempo, setTempoState] = useState(loadSavedTempo);

  useEffect(() => {
    localStorage.setItem(TEMPO_STORAGE_KEY, String(tempo));
  }, [tempo]);

  const setTempo = useCallback((value: number) => {
    setTempoState(Math.max(1, Math.min(300, value)));
  }, []);

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
        tempo,
        setTempo,
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
