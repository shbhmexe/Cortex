"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    // Avoid hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full opacity-0">
                <div className="h-4 w-4" />
            </Button>
        );
    }

    const toggleTheme = (event: React.MouseEvent) => {
        const isDark = resolvedTheme === "dark";
        // If current is Dark, we are going to Light -> Expand (New view on top)
        // If current is Light, we are going to Dark -> Shrink (Old view on top, animate clipPath to 0)

        const isExpanding = isDark;

        if (
            !document.startViewTransition ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            setTheme(isDark ? "light" : "dark");
            return;
        }

        const x = event.clientX;
        const y = event.clientY;
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        // Set transition type attribute for CSS
        document.documentElement.setAttribute('data-theme-transition', isExpanding ? 'expand' : 'shrink');

        const transition = document.startViewTransition(async () => {
            setTheme(isDark ? "light" : "dark");
        });

        transition.ready.then(() => {
            if (isExpanding) {
                // Dark -> Light: Expand new view (Light) from 0 to full
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`,
                        ],
                    },
                    {
                        duration: 600,
                        easing: "ease-in-out",
                        pseudoElement: "::view-transition-new(root)",
                        fill: "both",
                    }
                );
            } else {
                // Light -> Dark: Shrink old view (Light) from full to 0
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(${endRadius}px at ${x}px ${y}px)`,
                            `circle(0px at ${x}px ${y}px)`,
                        ],
                    },
                    {
                        duration: 600,
                        easing: "ease-in-out",
                        pseudoElement: "::view-transition-old(root)",
                        fill: "both",
                    }
                );
            }
        });

        // Clean up attribute after transition
        transition.finished.then(() => {
            document.documentElement.removeAttribute('data-theme-transition');
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-muted/30 border border-border/50 hover:bg-primary/10 hover:text-primary transition-colors relative"
            onClick={toggleTheme}
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={resolvedTheme}
                    initial={{ y: -20, opacity: 0, scale: 0.5 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 20, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                    {resolvedTheme === "dark" ? (
                        <Moon className="h-4 w-4" />
                    ) : (
                        <Sun className="h-4 w-4" />
                    )}
                </motion.div>
            </AnimatePresence>
            <span className="sr-only">Toggle theme</span>
        </Button>
    );
}
