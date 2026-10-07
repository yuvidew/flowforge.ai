"use client"

import { useEffect, useState } from "react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getConnectTabs } from "../constants"
import { CopyBlock } from "./copy-block"

/**
 * @component ConnectMcpDialog
 * @description Modal setup guide for the FlowForge MCP server: the server URL plus one tab of instructions per AI tool, custom connector and skills.
 * @param open Whether the dialog is visible.
 * @param onOpenChange Called when the dialog requests to open or close.
 */
export const ConnectMcpDialog = ({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
}) => {
    // Starts from the configured app URL for SSR, then switches to the real origin so it's right on any host.
    const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL ?? "")

    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    // Full MCP endpoint every client connects to.
    const mcpUrl = `${origin}/api/mcp`
    const tabs = getConnectTabs(mcpUrl)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl *:min-w-0">
                <DialogHeader>
                    <DialogTitle>Connect to MCP</DialogTitle>
                    <DialogDescription>
                        Let your AI tool create boards and draw diagrams in FlowForge. Sign in once with your FlowForge account — no API keys.
                    </DialogDescription>
                </DialogHeader>
                {/* Only this area scrolls, so the header stays pinned at the top. */}
                <ScrollArea className="h-[60vh] min-h-0">
                <div className="space-y-4 pr-3">
                <CopyBlock label="MCP server URL" code={mcpUrl} />
                <Tabs defaultValue={tabs[0].id}>
                    <TabsList className="h-auto max-w-full justify-start ">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id}>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {tabs.map((tab) => (
                        <TabsContent key={tab.id} value={tab.id} className="space-y-4 pt-2">
                            <p className="text-sm text-muted-foreground">{tab.intro}</p>
                            {tab.snippets.map((snippet) => (
                                <CopyBlock key={snippet.label} label={snippet.label} code={snippet.code} />
                            ))}
                            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                                {tab.steps.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ol>
                        </TabsContent>
                    ))}
                </Tabs>
                </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
