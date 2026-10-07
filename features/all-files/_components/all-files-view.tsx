"use client"
import { ErrorView } from "@/components/error-view"
import { LoadingView } from "@/components/loading-view"
import { ReactNode } from "react"
import { EntityContainer } from "@/components/entity-components/entity-container"
import { AllFilesHeader } from "./all-files-header"
import { BoardsList, BoardsPagination, BoardsSearch } from "./boards-view"

/**
 * @component AllFilesLoading
 * @description Suspense fallback shown while the files list is loading.
 */
export const AllFilesLoading = () => {

    return <LoadingView message='Loading boards...' />
}

/**
 * @component AllFilesError
 * @description Fallback shown by the error boundary when loading the files list fails.
 */
export const AllFilesError = () => {
    return <ErrorView message='Error loading boards' />
}

/**
 * @component AllFilesList
 * @description The active (non-archived) boards grid.
 */
export const AllFilesList = () => <BoardsList archived={false} />

/**
 * @component AllFilesContainer
 * @description Page shell for the all-files view: wires the header, search and pagination around the page content.
 * @param children - The list (or its loading/error state) rendered between the search bar and pagination.
 */
export const AllFilesContainer = ({ children }: { children: ReactNode }) => {
    return (
        <EntityContainer
            header={<AllFilesHeader/>}
            search={<BoardsSearch archived={false} />}
            pagination={<BoardsPagination archived={false} />}
        >
            {children}
        </EntityContainer>
    )
}