"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * @component ModeToggle
 * @description Dropdown button that lets the user switch between light, dark and system themes.
 */
export const ModeToggle = () => {
  const { setTheme, theme } = useTheme();

  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};
