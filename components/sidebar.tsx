"use client";

import { useEffect, useState } from "react";
import { useSessionId } from "@/hooks/use-session-id";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { History, Menu, MessageSquare, Box, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getRandomRoast } from "@/lib/roasts";

// Mock history fetcher for now, or use real API if we had one.
// Since we don't have a "get history" API route in the plan explicitly other than 'lib/memory', 
// we should probably add one or just mock it for the UI demo.
// Let's create a Client Component that fetches from a new route?
// Or just use local storage for "Recent" in this MVP?
// Plan says: "Fetch from local history or DB".
// Let's use LocalStorage for simplicity + robust demo, 
// as Qdrant fetch requires a new API route `app/api/history/route.ts`.

interface SidebarProps {
    onSelectHistory?: (item: { id: string; query: string; response: string; mode: string; relevancy: number }) => void;
    onDeleteHistory?: (id: string) => void;
    activeId?: string;
}

export function Sidebar({ onSelectHistory, onDeleteHistory, activeId }: SidebarProps) {
    const { sessionId } = useSessionId();
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/history`);
                if (res.ok) {
                    const data = await res.json();
                    setHistory(data);
                }
            } catch (error) {
                console.error("Failed to fetch history:", error);
            }
        };

        fetchHistory();
        // Also refresh on interval or event if needed, but for MVP this is fine.
        const interval = setInterval(fetchHistory, 2000);
        return () => clearInterval(interval);
    }, [sessionId]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Don't trigger onSelectHistory
        try {
            const res = await fetch(`/api/history?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                // Optimistic update
                setHistory(prev => prev.filter(item => item.id !== id));
                toast.error(getRandomRoast());
                onDeleteHistory?.(id);
            }
        } catch (error) {
            console.error("Failed to delete history:", error);
        }
    };

    return (
        <div className="w-[320px] border-r border-border/40 bg-card/30 backdrop-blur-xl flex flex-col h-full hidden lg:flex">
            <div className="p-6 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <History className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Recent Dives</span>
                </div>
            </div>

            <ScrollArea className="flex-1 px-3">
                <div className="py-6 space-y-2">
                    {history.length === 0 ? (
                        <div className="px-4 py-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border/50">
                            <span className="text-sm text-muted-foreground">No recent dives found.</span>
                        </div>
                    ) : (
                        history.map((item, i) => (
                            <div
                                key={i}
                                className={`w-full flex items-center gap-3 text-left p-4 rounded-2xl transition-all group animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer border ${item.id === activeId
                                    ? "bg-primary/10 border-primary/20 shadow-sm"
                                    : "hover:bg-primary/5 border-transparent hover:border-primary/10"}`}
                                onClick={() => onSelectHistory?.({ id: item.id, query: item.query, response: item.response, mode: item.mode, relevancy: item.relevancy })}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.id === activeId ? 'bg-primary' : 'bg-primary/40'}`} />
                                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest truncate">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className={`text-sm font-semibold truncate leading-tight mb-2 ${item.id === activeId ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'}`}>
                                        {item.query}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 ${item.mode === 'deep'
                                            ? 'bg-blue-500/10 text-blue-500'
                                            : 'bg-green-500/10 text-green-500'
                                            }`}>
                                            {item.mode === 'deep' ? 'Deep Mode' : 'Quick Mode'}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(e, item.id)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 z-20"
                                            title="Delete research"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Mobile Trigger
export function MobileSidebar() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="w-4 h-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
                <Sidebar />
            </SheetContent>
        </Sheet>
    );
}
