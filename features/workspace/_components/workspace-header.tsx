import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabsType } from "../types/types";
import { SaveIcon, Share2Icon } from "lucide-react";

interface Props {
    onSelectTab: (value: TabsType) => void;
    selectTab: TabsType
}

export const WorkspaceHeader = ({onSelectTab, selectTab}: Props) => {
    return (
        <header className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Logo />

                <h2>Workspace name</h2>
            </div>

            {/* switch */}
            <div className="flex items-center justify-center border">
                <Tabs defaultValue={selectTab} onValueChange={onSelectTab} >
                    <TabsList>
                        <TabsTrigger value="whiteboard">Whiteboard</TabsTrigger>
                        <TabsTrigger value="doc">Doc</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* extra button */}
            <div className="flex items-center gap-2">
                <Button>
                   <SaveIcon/> Save
                </Button>

                <Button variant={"outline"} >
                   <Share2Icon/> Save
                </Button>
            </div>
        </header>
    );
};
