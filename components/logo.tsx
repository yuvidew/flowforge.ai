import { ShapesIcon } from 'lucide-react'
import Link from 'next/link'

const logoClassName = "flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"

/**
 * @component Logo
 * @description App logo mark. Links to /all-files by default; pass `interactive={false}` when it is rendered inside another button/link (nested interactive elements are invalid HTML and cause hydration errors).
 * @param interactive - Render as a link (true) or a plain, non-clickable mark (false).
 */
export const Logo = ({ interactive = true }: { interactive?: boolean }) => {
    if (!interactive) {
        return (
            <div className={logoClassName}>
                <ShapesIcon className="size-4" />
            </div>
        )
    }

    return (
        <Link href="/all-files" aria-label="Go to all files" className={logoClassName}>
            <ShapesIcon className="size-4" />
        </Link>
    )
}
