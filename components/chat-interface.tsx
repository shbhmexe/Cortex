"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { useSessionId } from "@/hooks/use-session-id";
import { MessageBubble } from "@/components/message-bubble";
import { UserButton } from "@/components/user-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, Loader2, Plus } from "lucide-react";

interface ChatInterfaceProps {
    loadedHistory?: { query: string; response: string; mode: string } | null;
    onHistoryLoaded?: () => void;
    onNewChat?: () => void;
    reset?: boolean;
}

export default function ChatInterface({ loadedHistory, onHistoryLoaded, onNewChat, reset }: ChatInterfaceProps) {
    const { sessionId, newSession } = useSessionId();
    const [mode, setMode] = useState<"quick" | "deep">("quick");
    const scrollRef = useRef<HTMLDivElement>(null);

    const { messages, input, handleInputChange, handleSubmit, isLoading, data, setMessages } = useChat({
        body: {
            mode,
            sessionId
        },
    });

    // Handle external reset (e.g. on history deletion)
    useEffect(() => {
        if (reset) {
            handleNewChat();
            onHistoryLoaded?.(); // Reset the parent state as well
        }
    }, [reset]);

    // Auto-resume: Load full history for the current session on mount/sessionId change
    useEffect(() => {
        const resumeSession = async () => {
            if (!sessionId || messages.length > 0) return;
            try {
                const res = await fetch(`/api/history?sessionId=${sessionId}`);
                if (res.ok) {
                    const history = await res.json();
                    if (history && history.length > 0) {
                        // Transform history to ChatMessage format
                        const restoredMessages = history.flatMap((h: any) => [
                            { id: `res-q-${h.timestamp}`, role: "user", content: h.query },
                            { id: `res-a-${h.timestamp}`, role: "assistant", content: h.response, relevancy: h.relevancy }
                        ]);
                        setMessages(restoredMessages);
                        // Optional: set mode to the last message's mode
                        const lastMode = history[history.length - 1].mode;
                        if (lastMode) setMode(lastMode as "quick" | "deep");
                    }
                }
            } catch (err) {
                console.error("Failed to resume session:", err);
            }
        };

        resumeSession();
    }, [sessionId]);

    const handleNewChat = () => {
        newSession();
        setMessages([]);
        onNewChat?.();
    };

    // Load history when a sidebar item is clicked
    useEffect(() => {
        if (loadedHistory) {
            setMessages([
                { id: `hist-q-${Date.now()}`, role: "user", content: loadedHistory.query },
                { id: `hist-a-${Date.now()}`, role: "assistant", content: loadedHistory.response, relevancy: (loadedHistory as any).relevancy },
            ]);
            setMode(loadedHistory.mode === "deep" ? "deep" : "quick");
            onHistoryLoaded?.();
        }
    }, [loadedHistory]);

    // Auto-scroll to bottom when messages change (ChatGPT style)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    return (
        <div className="flex flex-col h-screen max-w-5xl mx-auto w-full border-x border-border/10 bg-background/20 backdrop-blur-sm">
            {/* Header / Mode Toggle */}
            <header className="sticky top-0 z-20 flex items-center justify-between py-5 px-8 glass-effect border-b">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="text-white font-bold text-lg">C</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
                        CortEx
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNewChat}
                        className="h-9 px-3 rounded-xl gap-2 hover:bg-primary/10 hover:text-primary transition-all group"
                    >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        <span className="text-xs font-semibold">New Chat</span>
                    </Button>
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-2xl border border-border/50">
                        <button
                            className={`text-xs px-4 py-2 rounded-xl transition-all duration-300 ${mode === "quick" ? "bg-background text-foreground shadow-sm font-semibold scale-105" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setMode("quick")}
                        >
                            Quick
                        </button>
                        <button
                            className={`text-xs px-4 py-2 rounded-xl transition-all duration-300 ${mode === "deep" ? "bg-background text-foreground shadow-sm font-semibold scale-105" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setMode("deep")}
                        >
                            Deep
                        </button>
                    </div>
                    <ThemeToggle />
                    <UserButton />
                </div>
            </header>


            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto py-20">
                        <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center border border-primary/10 mb-2">
                            <div className="text-5xl animate-pulse">🧠</div>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight">Deep Research for Engineers</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            CortEx explores documentation, research papers, code repositories, and engineering blogs to deliver
                            production-quality technical insights — not surface-level summaries.
                        </p>
                        <div className="grid grid-cols-2 gap-4 w-full pt-4">
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-left">
                                <span className="text-primary font-bold">⚡ Quick</span>
                                <p className="text-xs text-muted-foreground mt-1">Direct technical answers with cited sources and code snippets.</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 text-left">
                                <span className="text-primary font-bold">🧠 Deep</span>
                                <p className="text-xs text-muted-foreground mt-1">Multi-step autonomous research with trade-off analysis and recommendations.</p>
                            </div>
                        </div>
                    </div>
                )}

                {messages.map((m, i) => {
                    // Pass data to the last assistant message (always, not just while loading)
                    const isLastAssistant = m.role === 'assistant' &&
                        i === messages.map((msg, idx) => msg.role === 'assistant' ? idx : -1).filter(x => x >= 0).pop();
                    return (
                        <MessageBubble
                            key={m.id}
                            role={m.role as "user" | "assistant"}
                            content={m.content}
                            data={isLastAssistant ? data : undefined}
                            isTyping={isLastAssistant && isLoading}
                            relevancy={(m as any).relevancy}
                        />
                    );
                })}

                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex flex-col gap-4 ml-4">
                        <div className="flex items-center gap-3 text-muted-foreground text-sm">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                            </div>
                            <span className="font-medium animate-pulse">CortEx is waking up...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 md:p-8 shrink-0 bg-background/80 backdrop-blur-sm border-t">
                <form onSubmit={handleSubmit} className="relative flex items-center max-w-4xl mx-auto group">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder={mode === "quick" ? "Ask a technical question..." : "Describe your technical research goal in detail..."}
                        className="pr-16 py-8 text-lg rounded-3xl shadow-2xl border-border/40 focus-visible:ring-primary/20 focus-visible:border-primary/50 bg-card/50 transition-all duration-300 group-hover:border-primary/30"
                        disabled={isLoading}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2.5 top-2.5 h-11 w-11 rounded-2xl bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5 stroke-[2.5px]" />}
                    </Button>
                </form>
                <div className="text-center mt-4 h-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] transition-all duration-500 animate-in fade-in slide-in-from-bottom-1">
                        {mode === "deep"
                            ? "🧠 Deep Research Agent • Multi-Step Technical Analysis Active"
                            : "⚡ Quick Technical Insights • Real-Time Response Active"}
                    </p>
                </div>
            </div>
        </div>
    );
}
