"use client"

import { useEffect } from "react"

import { BoardCard } from "@/components/board-card"
import { EntityEmptyView } from "@/components/entity-components/entity-empty-view"
import { EntityList } from "@/components/entity-components/entity-list"
import { EntityPagination } from "@/components/entity-components/entity-pagination"
import { EntitySearch } from "@/components/entity-components/entity-search"
import { ErrorView } from "@/components/error-view"
import { LoadingView } from "@/components/loading-view"
import { useNewBoardState } from "@/hooks/use-new-board-state"
import { useGetProjects } from "../hook/use-get-projects"
import { useDebouncedSearch, useProjectsFilters } from "../hook/use-projects-filters"

/**
 * @component BoardsList
 * @description Responsive grid of the signed-in user's boards, shared by All Files (`archived={false}`) and Archived (`archived`). Renders loading → error → empty → data.
 * @param archived - Which set of boards to show.
 */
export const BoardsList = ({ archived }: { archived: boolean }) => {
    const { search, page } = useProjectsFilters()
    const { data, isPending, isError } = useGetProjects({ archived, search, page })

    // Opens the shared new-board dialog from the empty state's create button.
    const onOpen = useNewBoardState((state) => state.onOpen)

    if (isPending) return <LoadingView message="Loading boards..." />
    if (isError) return <ErrorView message="Error loading boards" />

    // Distinguishes "nothing matches your search" from "you have no boards at all".
    const emptyView = search ? (
        <EntityEmptyView empty_label="No results" message={`No boards match “${search}”.`} />
    ) : archived ? (
        <EntityEmptyView empty_label="No archived boards" message="Boards you archive will show up here." />
    ) : (
        <EntityEmptyView
            empty_label="No boards"
            message="You haven't created any boards yet. Get started by creating your first board."
            onNew={onOpen}
            label="New board"
        />
    )

    return (
        <EntityList
            items={data.projects}
            getKey={(project) => project.projectId}
            renderItem={(project) => (
                <BoardCard project={project} variant={archived ? "archived" : "active"} />
            )}
            emptyView={emptyView}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        />
    )
}

/**
 * @component BoardsSearch
 * @description Debounced name search for the boards list; the value is stored in the URL (`?q=`).
 * @param archived - Used in the placeholder text only.
 */
export const BoardsSearch = ({ archived }: { archived: boolean }) => {
    const { search, setSearch } = useProjectsFilters()
    const [input, setInput] = useDebouncedSearch(search, setSearch)

    return (
        <EntitySearch
            value={input}
            onChange={setInput}
            placeholder={archived ? "Search archived boards" : "Search boards"}
        />
    )
}

/**
 * @component BoardsPagination
 * @description Previous/next controls bound to the boards query and the URL (`?page=`). Steps back a page if the current one empties (e.g. last card archived or deleted).
 * @param archived - Which set of boards the pagination belongs to.
 */
export const BoardsPagination = ({ archived }: { archived: boolean }) => {
    const { search, page, setPage } = useProjectsFilters()
    const { data, isFetching } = useGetProjects({ archived, search, page })

    const totalPages = data?.totalPages ?? 0

    // Page past the end (after removing the last item on it) → go to the new last page.
    useEffect(() => {
        if (totalPages > 0 && page > totalPages) setPage(totalPages)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalPages, page])

    return (
        <EntityPagination
            disabled={isFetching}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
        />
    )
}
