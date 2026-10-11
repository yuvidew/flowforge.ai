import { ReactNode } from "react"

import { EntityContainer } from "@/components/entity-components/entity-container"
import { BoardsPagination, BoardsSearch } from "./boards-view"

/**
 * @component FavoritesHeader
 * @description Title and short description for the Favorites page (no actions).
 */
export const FavoritesHeader = () => (
    <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
        <p className="text-sm text-muted-foreground">
            Boards you&apos;ve pinned. They also stay at the top of All Files.
        </p>
    </section>
)

/**
 * @component FavoritesContainer
 * @description Page shell for the favorites view: same layout as All Files with the favorites header, search and pagination.
 * @param children - The pinned boards list rendered between the search bar and pagination.
 */
export const FavoritesContainer = ({ children }: { children: ReactNode }) => (
    <EntityContainer
        header={<FavoritesHeader />}
        search={<BoardsSearch archived={false} pinned />}
        pagination={<BoardsPagination archived={false} pinned />}
    >
        {children}
    </EntityContainer>
)
