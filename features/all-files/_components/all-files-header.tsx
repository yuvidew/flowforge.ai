import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getGreeting } from '@/lib/utils'
import { useUser } from '@clerk/nextjs'
import { PlusIcon } from 'lucide-react'
import { useNewBoardState } from '@/hooks/use-new-board-state'

/**
 * @component BranerSection
 * @description Banner at the top of the all-files page: greets the signed-in user by name with a short message and a button to create a new board.
 */
export const AllFilesHeader = () => {
    const { user, isLoaded } = useUser()

    // Opens the shared new-board dialog (mounted once in the root layout).
    const onOpen = useNewBoardState((state) => state.onOpen)

    // First name only keeps the greeting friendly; falls back to username while Clerk loads.
    const name = user?.firstName ?? user?.username ?? ""

    return (
        <section className="flex flex-col gap-4 rounded-xl  sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                {isLoaded ? (
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {getGreeting()}{name && `, ${name}`} 👋
                    </h1>
                ) : (
                    <Skeleton className="h-8 w-64" />
                )}
                <p className="text-sm text-muted-foreground">
                    Pick up where you left off, or start a fresh board for your next idea.
                </p>
            </div>
            <Button className="shrink-0" onClick={onOpen}>
                <PlusIcon />
                New board
            </Button>
        </section>
    )
}
