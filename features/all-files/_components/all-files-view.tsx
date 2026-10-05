"use client"
import { ErrorView } from "@/components/error-view"
import { LoadingView } from "@/components/loading-view"
import { ReactNode } from "react"
import { EntityContainer } from "@/components/entity-components/entity-container"
import { EntitySearch } from "@/components/entity-components/entity-search"
import { EntityPagination } from "@/components/entity-components/entity-pagination"
import { AllFilesHeader } from "./all-files-header"
import { EntityEmptyView } from "@/components/entity-components/entity-empty-view"
import { EntityList } from "@/components/entity-components/entity-list"
import { EntityItem } from "@/components/entity-components/entity-item"

/**
 * @component AllFilesLoading
 * @description Suspense fallback shown while the files list is loading.
 */
export const AllFilesLoading = () => {

    return <LoadingView message='Loading workflows...' />
}

/**
 * @component AllFilesError
 * @description Fallback shown by the error boundary when loading the files list fails.
 */
export const AllFilesError = () => {
    return <ErrorView message='Error loading workflows' />
}

/**
 * @component AllFilesView
 * @description Empty state shown when the user has no board files yet, with a prompt to create the first one.
 */
export const AllFilesView = () => {

    return (
        <>
            <EntityEmptyView
                message="You haven't created any boards yet. Get started by creating your first board."
                isLoading = {false}
                onNew={() => {}}
            />
        </>
    )
}

/**
 * @component AllFilesItem
 * @description A single row in the files list, linking to the file and offering a remove action. Placeholder content until the file type is defined.
 * @param data - The file record to render (currently untyped `[]`; replace with the real file type).
 */
export const AllFilesItem = ({
    data
} : {data: []}) => {

    return (
        <EntityItem
            href={`/workflows/`}
            title={""}
            subtitle={
                <>
                   
                </>
            }
            image = {
                <div className=' size-8 flex items-center justify-center'>
                    h
                </div>
            }

            onRemove = {() => {}}
            isRemoving = {false}
        />
    )
}


/**
 * @component AllFilesList
 * @description Renders the user's board files. Placeholder content until the files query is wired in.
 */
export const AllFilesList = () => {
    return (
        <EntityList
            items={[]}
            getKey={() => ""}
            renderItem={(workflow) => <AllFilesItem data = {workflow} />}
            emptyView={<AllFilesView/>}
        />
    )
}

/**
 * @component AllFilesSearch
 * @description Search input for filtering board files. Currently uncontrolled placeholder until search state is wired in.
 */
export const AllFilesSearch = () => {
    return (
        <EntitySearch
            value={""}
            onChange={() => {}}
            placeholder='Search board files'
        />
    )
}

/**
 * @component AllFilesPagination
 * @description Page controls for the files list. Currently static placeholder values until the list query is wired in.
 */
export const AllFilesPagination = () => {

    return (
        <EntityPagination
            disabled={false}
            page={1}
            totalPages={20}
            onPageChange={() => {}}
        />
    )
}

/**
 * @component AllFilesContainer
 * @description Page shell for the all-files view: wires the header, search and pagination around the page content.
 * @param children - The list (or its loading/error state) rendered between the search bar and pagination.
 */
export const AllFilesContainer = ({ children }: { children: ReactNode }) => {
    return (
        <EntityContainer
            header={<AllFilesHeader/>}
            search={<AllFilesSearch />}
            pagination={<AllFilesPagination />}
        >
            {children}
        </EntityContainer>
    )
}