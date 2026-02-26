import { createContext, useContext, useState, ReactNode } from "react";

interface TimeSignatureContextValue {
  beatsPerMeasure: number;
  timeSigDenominator: number;
  setTimeSignature: (numerator: number, denominator: number) => void;
}

const TimeSignatureContext = createContext<TimeSignatureContextValue | null>(
  null
);

export function TimeSignatureProvider({ children }: { children: ReactNode }) {
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [timeSigDenominator, setTimeSigDenominator] = useState(4);

  const setTimeSignature = (numerator: number, denominator: number) => {
    setBeatsPerMeasure(numerator);
    setTimeSigDenominator(denominator);
  };

  return (
    <TimeSignatureContext.Provider
      value={{ beatsPerMeasure, timeSigDenominator, setTimeSignature }}
    >
      {children}
    </TimeSignatureContext.Provider>
  );
}

export function useTimeSignature() {
  const ctx = useContext(TimeSignatureContext);
  if (!ctx) throw new Error("useTimeSignature must be within provider");
  return ctx;
}
