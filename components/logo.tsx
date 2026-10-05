import { ShapesIcon } from 'lucide-react'
import React from 'react'

export const Logo = () => {
    return (
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ShapesIcon className="size-4" />
        </div>
    )
}
