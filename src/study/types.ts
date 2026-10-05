export interface BookState { page: number; total: number; busy: boolean }
export interface RecordVisual { src: string; left: number; top: number; size: number }
export interface StudyScene {
  turn: (direction: -1 | 1) => void
  close: () => void
  captureRecord: () => RecordVisual | null
  getRecordVisual: () => RecordVisual | null
  showRecord: (visible: boolean) => void
  setActive: (active: boolean) => void
  setBackgroundOnly: (visible: boolean) => void
  setDepartureProgress: (amount: number) => void
  dispose: () => void
}

