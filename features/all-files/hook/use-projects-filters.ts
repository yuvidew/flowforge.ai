import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Search text and page number live in the URL (?q=&page=) so they survive refreshes and are shared by the list, search box and pagination.
export const useProjectsFilters = () => {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const search = searchParams.get("q") ?? ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    // Writes the given params to the URL, dropping empty values / page 1 to keep it clean.
    const update = (next: { q?: string; page?: number }) => {
        const params = new URLSearchParams(searchParams.toString())
        const q = next.q ?? search
        const nextPage = next.page ?? page
        if (q) params.set("q", q)
        else params.delete("q")
        if (nextPage > 1) params.set("page", String(nextPage))
        else params.delete("page")
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }

    return {
        search,
        page,
        // Changing the search always returns to page 1.
        setSearch: (q: string) => update({ q, page: 1 }),
        setPage: (p: number) => update({ page: p }),
    }
}

// Local input value that pushes to the URL after a short pause, so typing doesn't fire a request per keystroke.
export const useDebouncedSearch = (value: string, onCommit: (value: string) => void, delay = 300) => {
    const [input, setInput] = useState(value)

    // Keeps the input in sync if the URL changes from elsewhere (e.g. navigating to another page).
    useEffect(() => {
        setInput(value)
    }, [value])

    useEffect(() => {
        if (input === value) return
        const timeout = setTimeout(() => onCommit(input), delay)
        return () => clearTimeout(timeout)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input])

    return [input, setInput] as const
}
