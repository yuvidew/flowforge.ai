import { create } from "zustand"

type NewBoardState = {
    isOpen: boolean
    onOpen: () => void
    onClose: () => void
    setOpen: (open: boolean) => void
}

// Shared open/close state for the new-board dialog so any button can trigger it.
export const useNewBoardState = create<NewBoardState>((set) => ({
    isOpen: false,
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
    setOpen: (open) => set({ isOpen: open }),
}))
