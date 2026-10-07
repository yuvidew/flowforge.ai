import { ReactNode } from "react"

import { EntityContainer } from "@/components/entity-components/entity-container"
import { BoardsPagination, BoardsSearch } from "./boards-view"

/**
 * @component ArchivedHeader
 * @description Title and short description for the Archived page (no actions).
 */
export const ArchivedHeader = () => (
    <section className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Archived</h1>
        <p className="text-sm text-muted-foreground">
            Boards you&apos;ve archived. Restore them any time or delete them for good.
        </p>
    </section>
)

/**
 * @component ArchivedContainer
 * @description Page shell for the archived view: same layout as All Files with the archived header, search and pagination.
 * @param children - The archived boards list rendered between the search bar and pagination.
 */
export const ArchivedContainer = ({ children }: { children: ReactNode }) => (
    <EntityContainer
        header={<ArchivedHeader />}
        search={<BoardsSearch archived />}
        pagination={<BoardsPagination archived />}
    >
        {children}
    </EntityContainer>
)
