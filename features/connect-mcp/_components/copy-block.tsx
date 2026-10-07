"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"

/**
 * @component CopyBlock
 * @description Labelled monospace block with a button that copies its text to the clipboard.
 * @param label - Short caption shown above the block.
 * @param code - The text displayed and copied.
 */
export const CopyBlock = ({ label, code }: { label: string; code: string }) => {
    // Briefly true after a successful copy so the icon swaps to a check mark.
    const [copied, setCopied] = useState(false)

    // Copies the text; the clipboard API can be blocked, so failures get an error toast.
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            toast.add({ title: "Copied to clipboard", type: "success" })
            setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.add({ title: "Couldn't copy", description: "Select the text and copy it manually.", type: "error" })
        }
    }

    return (
        <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="relative rounded-lg border bg-muted/50">
                <pre className="max-h-72 overflow-y-auto p-3 pr-12 text-sm whitespace-pre-wrap break-all"><code>{code}</code></pre>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1.5 top-1.5"
                    aria-label={`Copy ${label}`}
                    onClick={handleCopy}
                >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
            </div>
        </div>
    )
}
