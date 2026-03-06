"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { useSessionId } from "@/hooks/use-session-id";
import { MessageBubble } from "@/components/message-bubble";
import { UserButton } from "@/components/user-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, Download, Loader2, Plus, Users, FolderGit2, X, FileText, Paperclip } from "lucide-react";
import { exportChatToPDF } from "@/lib/export-pdf";
import { toast } from "sonner";
import { CollabWorkspace } from "./collab-workspace";
import { ModelSelector } from "@/components/model-selector";

interface ChatInterfaceProps {
    loadedHistory?: { query: string; response: string; mode: string } | null;
    onHistoryLoaded?: () => void;
    onNewChat?: () => void;
    reset?: boolean;
    ingestedRepo?: string | null;
    onDismissRepo?: () => void;
    activeDoc?: string | null;
    onDismissDoc?: () => void;
    onChatComplete?: () => void;
}

export default function ChatInterface({ loadedHistory, onHistoryLoaded, onNewChat, reset, ingestedRepo, onDismissRepo, activeDoc, onDismissDoc, onChatComplete }: ChatInterfaceProps) {
    const { sessionId, newSession, setSessionTo } = useSessionId();
    const [mode, setMode] = useState<"quick" | "deep">("quick");
    const scrollRef = useRef<HTMLDivElement>(null);
    const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
    // Ref to always get fresh model value in submit handler (avoids stale closure)
    const selectedModelRef = useRef("llama-3.3-70b-versatile");
    const handleModelChange = (m: string) => {
        setSelectedModel(m);
        selectedModelRef.current = m;
    };

    // Collaborative Workspace State
    const [collabSession, setCollabSession] = useState<{ roomId: string, initialCode: string, language: string } | null>(null);
    const [showJoinInput, setShowJoinInput] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState("");

    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Map from message index (as string) to image data URL for chat bubble display
    const messageImages = useRef<Map<string, string>>(new Map());
    const lastProcessedDataLen = useRef(0);
    const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const [meta, base64] = dataUrl.split(",");
            const mimeType = meta.split(":")[1].split(";")[0];
            setAttachedImage({ base64, mimeType, preview: dataUrl });
        };
        reader.readAsDataURL(file);
        // Reset the input so same file can be re-selected
        e.target.value = "";
    };

    const { messages, input, handleInputChange, handleSubmit: chatSubmit, isLoading, data, setMessages, setInput, stop } = useChat({
        onFinish: () => {
            setTimeout(() => onChatComplete?.(), 500);
        },
    });

    // Custom submit handler — always picks fresh model from ref
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        // If image is attached, save preview keyed by the upcoming message index
        if (attachedImage) {
            messageImages.current.set(String(messages.length), attachedImage.preview);
        }
        chatSubmit(e, {
            body: {
                model: selectedModelRef.current,
                mode,
                sessionId,
                ingestedRepo: ingestedRepo ?? null,
                activeDocName: activeDoc ?? null,
                imageBase64: attachedImage?.base64 ?? null,
                imageMimeType: attachedImage?.mimeType ?? null,
            },
        });
        setAttachedImage(null);
    };

    // Auto-session management: watch for NEW topic_detection events only
    useEffect(() => {
        if (!data || !Array.isArray(data) || data.length <= lastProcessedDataLen.current) return;
        // Only look at events added since last check
        const newEvents = data.slice(lastProcessedDataLen.current);
        lastProcessedDataLen.current = data.length;

        const flatNew = newEvents.flatMap((d: any) => Array.isArray(d) ? d : [d]);
        const sessionEvent = flatNew.find((d: any) => d.type === "new_session_id");
        if (sessionEvent && !isLoading) {
            // New topic detected AND backend gave us the brand new ID
            setTimeout(() => {
                setSessionTo(sessionEvent.value); // set session securely!

                // Visually break off the old chat — keep ONLY the new topic's Q&A
                setMessages(prev => prev.slice(-2));

                onChatComplete?.();               // tell generic UI side effects to sync
            }, 500);
        }
    }, [data, isLoading]);


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
        setCollabSession(null);
        onNewChat?.();
    };

    // Listen for custom event from code blocks to open collab room
    useEffect(() => {
        const handleOpenCollab = (e: any) => {
            setCollabSession(e.detail);
        };
        window.addEventListener("open-collab", handleOpenCollab);
        return () => window.removeEventListener("open-collab", handleOpenCollab);
    }, []);

    // Listen for double-tap mention/reply from message bubbles
    useEffect(() => {
        const handleMentionReply = (e: any) => {
            const mentionedText = e.detail?.text || "";
            // Truncate to first 100 chars for the mention
            const snippet = mentionedText.slice(0, 100).trim();
            if (snippet) {
                setInput(`Regarding: "${snippet}..." — `);
                inputRef.current?.focus();
            }
        };
        window.addEventListener("mention-reply", handleMentionReply);
        return () => window.removeEventListener("mention-reply", handleMentionReply);
    }, [setInput]);

    // Load history when a sidebar item is clicked
    useEffect(() => {
        if (loadedHistory) {
            setMessages([
                { id: `hist-q-${Date.now()}`, role: "user", content: loadedHistory.query },
                { id: `hist-a-${Date.now()}`, role: "assistant", content: loadedHistory.response, relevancy: (loadedHistory as any).relevancy } as any,
            ]);
            setMode(loadedHistory.mode === "deep" ? "deep" : "quick");
            onHistoryLoaded?.();
        }
    }, [loadedHistory]);

    const handleExportPDF = async () => {
        if (messages.length === 0) {
            toast.error("No messages to export!");
            return;
        }
        try {
            await exportChatToPDF(messages, sessionId || "session");
            toast.success("PDF report generated successfully!");
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export PDF.");
        }
    };

    // Auto-scroll to bottom when messages change (ChatGPT style)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    return (
        <div className="flex flex-col h-screen w-full bg-background transition-all duration-700 relative overflow-hidden hero-gradient">
            {/* Background Decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

            {/* Header / Mode Toggle */}
            <header className="sticky top-0 z-30 flex items-center justify-between py-4 px-6 md:px-10 bg-background/40 backdrop-blur-2xl border-b border-white/5">
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
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExportPDF}
                        disabled={messages.length === 0}
                        className="h-9 px-3 rounded-xl gap-2 hover:bg-primary/10 hover:text-primary transition-all group"
                    >
                        <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform duration-300" />
                        <span className="text-xs font-semibold">Export PDF</span>
                    </Button>

                    {/* Join Collaborative Room UI */}
                    <div className="flex items-center">
                        {showJoinInput ? (
                            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl animate-in zoom-in duration-200">
                                <Input
                                    className="h-7 w-20 text-xs text-center font-mono placeholder:font-sans bg-background/50 border-white/10"
                                    placeholder="6-digit PIN"
                                    value={joinRoomId}
                                    onChange={e => setJoinRoomId(e.target.value)}
                                    maxLength={6}
                                />
                                <Button size="sm" className="h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white transition-colors" onClick={() => {
                                    if (joinRoomId.length === 6) {
                                        setCollabSession({ roomId: joinRoomId, initialCode: "", language: "plaintext" });
                                        setShowJoinInput(false);
                                        setJoinRoomId("");
                                    } else {
                                        toast.error("Please enter a valid 6-digit Room ID");
                                    }
                                }}>Join</Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-white/10" onClick={() => setShowJoinInput(false)}>×</Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowJoinInput(true)}
                                className="h-9 px-3 rounded-xl gap-2 hover:bg-blue-500/10 hover:text-blue-400 text-muted-foreground transition-all border-white/5 bg-background shadow-sm"
                            >
                                <Users className="w-4 h-4" />
                                <span className="text-xs font-semibold">Join Room</span>
                            </Button>
                        )}
                    </div>

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
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-12 py-10 space-y-10 scroll-smooth custom-scrollbar max-w-5xl mx-auto w-full relative z-10">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-8 max-w-2xl mx-auto py-12 md:py-24 animate-in fade-in zoom-in-95 duration-1000">
                        {/* Futuristic Brain Icon */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
                            <div className="w-28 h-28 md:w-32 md:h-32 rounded-[3rem] bg-card/50 backdrop-blur-2xl flex items-center justify-center border border-white/10 shadow-2xl relative z-10 hover:scale-105 transition-transform duration-500">
                                <span className="text-7xl md:text-8xl filter drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]">🧠</span>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
                                CortEx
                            </h2>
                            <p className="text-muted-foreground leading-relaxed md:text-xl max-w-lg mx-auto font-medium">
                                The future of technical research. Autonomous agents at your fingertips.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl mt-12 relative z-10">
                            <div
                                onClick={() => setMode("quick")}
                                className={`flex-1 p-6 rounded-3xl cursor-pointer transition-all duration-500 group ${mode === 'quick' ? 'bg-primary/10 border-primary/40 glow-primary scale-105' : 'bg-card/30 border-white/5 hover:bg-card/50'}`}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">⚡</div>
                                <h3 className="text-lg font-bold mb-2">Quick Dive</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">Lightning fast technical synthesis from verified docs.</p>
                            </div>
                            <div
                                onClick={() => setMode("deep")}
                                className={`flex-1 p-6 rounded-3xl cursor-pointer transition-all duration-500 group ${mode === 'deep' ? 'bg-primary/10 border-primary/40 glow-primary scale-105' : 'bg-card/30 border-white/5 hover:bg-card/50'}`}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">🧠</div>
                                <h3 className="text-lg font-bold mb-2">Deep Logic</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">Multi-step agentic research for complex engineering problems.</p>
                            </div>
                        </div>
                    </div>
                )}



                {messages.map((m, i) => {
                    // Pass data to the last assistant message (always, not just while loading)
                    const isLastAssistant = m.role === 'assistant' &&
                        i === messages.map((msg, idx) => msg.role === 'assistant' ? idx : -1).filter(x => x >= 0).pop();
                    const imagePreview = m.role === 'user' ? messageImages.current.get(String(i)) : undefined;
                    return (
                        <MessageBubble
                            key={m.id}
                            role={m.role as "user" | "assistant"}
                            content={m.content}
                            data={isLastAssistant ? data : undefined}
                            isTyping={isLastAssistant && isLoading}
                            relevancy={(m as any).relevancy}
                            imagePreview={imagePreview}
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
            <div className="w-full shrink-0 bg-background/40 backdrop-blur-2xl border-t border-white/5 z-20">
                <div className="max-w-4xl mx-auto px-4 md:px-8 pt-3 pb-8">

                    {/* === CONTEXT BANNERS — sticky above input === */}
                    <div className="flex flex-col gap-2 mb-3">
                        {ingestedRepo && (
                            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                                <div className="relative flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/5 border border-primary/20">
                                    <div className="flex items-center w-full sm:w-auto">
                                        <button
                                            onClick={onDismissRepo}
                                            className="absolute top-2 right-2 sm:relative sm:top-0 sm:right-0 sm:order-last sm:ml-2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                            title="Dismiss"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <FolderGit2 className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-bold text-primary">Repo Context:</span>
                                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-xs">{ingestedRepo}</span>
                                        </div>
                                    </div>

                                    {messages.length === 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0 sm:ml-2">
                                            {["Main components?", "Architecture?", "Authentication?", "API structure?"].map(prompt => (
                                                <button
                                                    key={prompt}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const event = { target: { value: `[${ingestedRepo}] ${prompt}` } } as React.ChangeEvent<HTMLInputElement>;
                                                        handleInputChange(event);
                                                    }}
                                                    className="text-[11px] px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors font-medium"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeDoc && (
                            <div className="animate-in slide-in-from-bottom-2 fade-in duration-300">
                                <div className="relative flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                                    <div className="flex items-center w-full sm:w-auto">
                                        <button
                                            onClick={onDismissDoc}
                                            className="absolute top-2 right-2 sm:relative sm:top-0 sm:right-0 sm:order-last sm:ml-2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
                                            title="Dismiss"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <FileText className="w-4 h-4 text-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-500">Doc Context:</span>
                                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-xs">{activeDoc}</span>
                                        </div>
                                    </div>

                                    {messages.length === 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0 sm:ml-2">
                                            {["Summarize this document", "What are the main topics?", "Key takeaways?"].map(prompt => (
                                                <button
                                                    key={prompt}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const event = { target: { value: `[${activeDoc}] ${prompt}` } } as React.ChangeEvent<HTMLInputElement>;
                                                        handleInputChange(event);
                                                    }}
                                                    className="text-[11px] px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 transition-colors font-medium"
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="relative flex flex-col items-stretch w-full group gap-0">
                        <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        {/* Image preview strip */}
                        {attachedImage && (
                            <div className="flex items-center gap-2 px-4 pt-3 pb-1 relative z-20">
                                <div className="relative group/img">
                                    <img src={attachedImage.preview} alt="attached" className="h-14 w-14 object-cover rounded-xl border border-white/10 shadow-md" />
                                    <button type="button" onClick={() => setAttachedImage(null)}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center hover:bg-red-500 transition-colors">
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                                <span className="text-xs text-muted-foreground">Image attached — will be analyzed by vision model</span>
                            </div>
                        )}
                        <div className="relative flex items-center w-full">
                            {/* Model Selector inside input — left side */}
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center">
                                <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />
                                <div className="w-px h-4 bg-white/10 ml-1 mr-0.5" />
                            </div>
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={handleInputChange}
                                placeholder={mode === "quick" ? "Ask anything technical..." : "Describe a complex research objective..."}
                                className="pl-[9.5rem] pr-16 py-8 text-base md:text-lg rounded-[2rem] shadow-2xl border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 bg-card/40 backdrop-blur-xl transition-all duration-300 group-hover:border-primary/30 relative z-10"
                                disabled={isLoading}
                            />

                            {/* Hidden file input for image upload */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageSelect}
                            />
                            {/* Image attach button */}
                            {!isLoading && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`absolute right-[3.75rem] top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${attachedImage
                                        ? "bg-primary/20 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                        }`}
                                    title="Attach image"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>
                            )}
                            {isLoading ? (
                                <Button
                                    type="button"
                                    size="icon"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        stop();
                                    }}
                                    className="absolute right-3 top-3 bottom-3 aspect-square h-auto w-12 rounded-[1.4rem] bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-500 hover:scale-105 transition-all active:scale-95 shadow-lg z-20 flex items-center justify-center border border-zinc-700 hover:border-red-500/30"
                                    title="Stop generating"
                                >
                                    <div className="w-3.5 h-3.5 bg-current rounded-[2px]" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!input.trim() && !attachedImage}
                                    className="absolute right-3 top-3 bottom-3 aspect-square h-auto w-12 rounded-[1.4rem] bg-primary text-primary-foreground hover:scale-105 transition-all active:scale-95 shadow-lg shadow-primary/20 z-20"
                                >
                                    <ArrowUp className="w-6 h-6 stroke-[3px]" />
                                </Button>
                            )}
                        </div>
                    </form>
                </div>
                <div className="text-center py-3 bg-background border-t-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        {mode === "deep"
                            ? <><span className="text-pink-500">🧠</span> Deep Research Agent • Multi-Step Technical Analysis Active</>
                            : <><span className="text-orange-500">⚡</span> Quick Technical Insights • Real-Time Response Active</>}
                    </p>
                </div>
            </div>

            {/* Global Collaborative Workspace Slider */}
            {collabSession && (
                <CollabWorkspace
                    roomId={collabSession.roomId}
                    initialCode={collabSession.initialCode}
                    language={collabSession.language}
                    onClose={() => setCollabSession(null)}
                />
            )}
        </div>
    );
}
