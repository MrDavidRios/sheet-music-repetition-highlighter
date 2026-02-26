import Soundfont, { Player } from "soundfont-player";

let audioContext: AudioContext | null = null;
let piano: Player | null = null;
let loadingPromise: Promise<void> | null = null;

async function initAudio(): Promise<void> {
  if (piano) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    audioContext = new AudioContext();
    piano = await Soundfont.instrument(audioContext, "acoustic_grand_piano");
  })();

  return loadingPromise;
}

export interface PlayableNote {
  index: number;
  pitch: string;
  measure: number;
  beat: number | null;
}

export interface PlayPatternOptions {
  tempo?: number;
  beatsPerMeasure?: number;
  timeSigDenominator?: number;
  onNotePlay?: (noteIndices: number[]) => void;
  onPlaybackEnd?: () => void;
}

export async function playPattern(
  notes: PlayableNote[],
  options: PlayPatternOptions = {}
): Promise<void> {
  const {
    tempo = 120,
    beatsPerMeasure = 4,
    timeSigDenominator = 4,
    onNotePlay,
    onPlaybackEnd,
  } = options;

  await initAudio();
  if (!audioContext || !piano) return;

  // Resume context if suspended (browser autoplay policy)
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const beatDuration = 60 / tempo;
  const startTime = audioContext.currentTime;

  // Calculate measure duration in quarter-note units
  // 3/8: 3 / (8/4) = 1.5 quarter notes per measure
  // 4/4: 4 / (4/4) = 4 quarter notes per measure
  const measureDuration = beatsPerMeasure / (timeSigDenominator / 4);

  // Calculate absolute position in quarter-note units
  // beat is normalized to measure (1.0 to ~2.0), so (beat-1) is fractional position
  const getAbsoluteBeat = (note: PlayableNote): number => {
    const beat = note.beat ?? 1;
    return (note.measure - 1 + beat - 1) * measureDuration;
  };

  // Group notes by absolute beat for polyphonic playback
  const notesByBeat = new Map<number, PlayableNote[]>();
  notes.forEach((note) => {
    const absBeat = getAbsoluteBeat(note);
    if (!notesByBeat.has(absBeat)) notesByBeat.set(absBeat, []);
    notesByBeat.get(absBeat)!.push(note);
  });

  // Sort beats and play
  const beats = [...notesByBeat.keys()].sort((a, b) => a - b);
  const firstBeat = beats[0] ?? 0;

  let lastDelayMs = 0;

  for (const beat of beats) {
    const timeSec = startTime + (beat - firstBeat) * beatDuration;
    const delayMs = (beat - firstBeat) * beatDuration * 1000;
    lastDelayMs = delayMs;

    console.log(delayMs, beat - firstBeat, beatDuration);

    const notesAtBeat = notesByBeat.get(beat)!;

    for (const note of notesAtBeat) {
      piano.play(note.pitch, timeSec, { duration: beatDuration * 0.9 }); // Create slight gap between notes
    }

    // Schedule visual highlight
    if (onNotePlay) {
      const indices = notesAtBeat.map((n) => n.index);
      setTimeout(() => onNotePlay(indices), delayMs);
    }
  }

  // Schedule end callback
  if (onPlaybackEnd) {
    const endDelayMs = lastDelayMs + beatDuration * 1000;
    console.log("end delay ms: ", endDelayMs);
    setTimeout(onPlaybackEnd, endDelayMs);
  }
}
