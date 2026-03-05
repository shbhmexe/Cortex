"use client"
import React, { useEffect, useState, useCallback, useRef } from "react";
import { RoomProvider, useRoom, useOthers, useUpdateMyPresence, useMyPresence } from "../liveblocks.config";
import { ClientSideSuspense } from "@liveblocks/react";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import * as Y from "yjs";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import { X, Play, Loader2, Terminal, Users, Code2 } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

export function CollabWorkspace({ roomId, initialCode, language, onClose }: { roomId: string, initialCode?: string, language: string, onClose: () => void }) {
    return (
        <RoomProvider id={roomId} initialPresence={{ cursor: null }}>
            <ClientSideSuspense fallback={<div className="h-full w-full flex items-center justify-center bg-black/50 backdrop-blur-sm fixed inset-0 z-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                {() => <WorkspaceContent roomId={roomId} initialCode={initialCode || ""} language={language} onClose={onClose} />}
            </ClientSideSuspense>
        </RoomProvider>
    );
}

function WorkspaceContent({ roomId, initialCode, language, onClose }: { roomId: string, initialCode: string, language: string, onClose: () => void }) {
    const room = useRoom();
    const others = useOthers();
    const [myPresence, updateMyPresence] = useMyPresence();

    const [yjsCode, setYjsCode] = useState<string>(initialCode);
    const [activeLanguage, setActiveLanguage] = useState<string>(language);
    const [doc, setDoc] = useState<Y.Doc>();
    const [provider, setProvider] = useState<LiveblocksYjsProvider>();
    const yTextRef = useRef<Y.Text | null>(null);
    const yLangRef = useRef<Y.Text | null>(null);
    const editorRef = useRef<any>(null);
    const isLocalUpdate = useRef<boolean>(false);

    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState<{ stdout: string; stderr: string; error: string; results: any[] } | null>(null);

    // Track user join/leave for toast notifications
    const previousOthersIds = useRef<string[]>([]);

    useEffect(() => {
        const currentIds = others.map(o => String(o.connectionId));
        const prevIds = previousOthersIds.current;

        // Find users who joined
        const joined = currentIds.filter(id => !prevIds.includes(id));
        joined.forEach(id => {
            const user = others.find(o => String(o.connectionId) === id);
            toast.success(`User joined the session`, {
                description: `A new collaborator has entered the workspace.`,
                duration: 3000
            });
        });

        // Find users who left
        const left = prevIds.filter(id => !currentIds.includes(id));
        left.forEach(id => {
            toast.info(`User left the session`, {
                description: `A collaborator has left the workspace.`,
                duration: 3000
            });
        });

        previousOthersIds.current = currentIds;
    }, [others]);

    // Initialize Yjs Document connected to Liveblocks Room
    useEffect(() => {
        const yDoc = new Y.Doc();
        const yProvider = new LiveblocksYjsProvider(room as any, yDoc);
        const yText = yDoc.getText("code");
        const yLang = yDoc.getText("language");

        let synced = false;

        const handleSync = (isSynced: boolean) => {
            if (isSynced && !synced) {
                synced = true;

                // Only insert if the document is TRULY empty on the server after first sync
                if (yText.toString() === "" && initialCode) {
                    yText.insert(0, initialCode);
                } else if (yText.toString() !== "") {
                    setYjsCode(yText.toString());
                }

                if (yLang.toString() === "" && language !== "plaintext") {
                    yLang.insert(0, language);
                } else if (yLang.toString() !== "") {
                    setActiveLanguage(yLang.toString());
                }
            }
        };

        yProvider.on("sync", handleSync);

        yTextRef.current = yText;
        yLangRef.current = yLang;

        // Listen for changes from other users
        yText.observe(() => {
            if (!isLocalUpdate.current) {
                setYjsCode(yText.toString());
            }
        });

        yLang.observe(() => {
            setActiveLanguage(yLang.toString());
        });

        setDoc(yDoc);
        setProvider(yProvider);

        return () => {
            yProvider.off("sync", handleSync);
            yDoc.destroy();
            yProvider.destroy();
        };
    }, [room, initialCode, language]);

    const handleCodeChange = (newCode: string) => {
        isLocalUpdate.current = true;
        setYjsCode(newCode);

        // Simple syncing logic: wipe and rewrite for hackathon
        if (yTextRef.current) {
            const currentYjsString = yTextRef.current.toString();
            if (currentYjsString !== newCode) {
                // Ensure we batch YJS operations so observers don't fire midway
                doc?.transact(() => {
                    yDocSyncReplace(yTextRef.current!, newCode);
                });
            }
        }

        // Reset local update flag after React has processed the state change
        setTimeout(() => {
            isLocalUpdate.current = false;
        }, 10);
    };

    // Helper to replace text without destroying the whole doc history too badly
    const yDocSyncReplace = (yText: Y.Text, newText: string) => {
        const currentLen = yText.length;
        if (currentLen > 0) {
            yText.delete(0, currentLen);
        }
        yText.insert(0, newText);
    };

    const handleRun = async () => {
        setIsRunning(true);
        setOutput(null);
        try {
            const res = await fetch('/api/run-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: yjsCode, language: activeLanguage })
            });
            const data = await res.json();
            setOutput(data);
        } catch (error: any) {
            setOutput({ stdout: "", stderr: "", error: error.message, results: [] });
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div
            className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] bg-background border-l border-white/10 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-300"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 glass-effect">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/20 p-2 rounded-xl">
                        <Code2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-foreground font-bold text-lg flex items-center gap-2">
                            Co-Code Session <span className="text-[10px] bg-foreground/10 px-2 py-0.5 rounded text-foreground/70 uppercase tracking-widest">{activeLanguage}</span>
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono bg-foreground/5 px-2 py-0.5 rounded text-primary">ID: {roomId}</span>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" /> {others.length + 1} Online
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleRun} disabled={isRunning} size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        Run Live
                    </Button>
                    <button onClick={onClose} className="p-2 hover:bg-foreground/10 rounded-full transition-colors text-foreground/70 hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Active Users Avatars */}
            {others.length > 0 && (
                <div className="px-6 py-2 bg-foreground/5 flex items-center gap-2 overflow-x-auto border-b border-border shadow-inner">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-2">Connected:</div>
                    <div className="w-6 h-6 rounded-full bg-primary/40 border border-primary text-[10px] flex items-center justify-center font-bold text-foreground shadow-lg relative" title="You">
                        U
                    </div>
                    {others.map((other) => (
                        <div
                            key={other.connectionId}
                            className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center font-bold text-black border border-white/20 shadow-lg"
                            style={{ backgroundColor: other.info?.color as string || '#fff' }}
                            title={other.info?.name as string || 'Anonymous'}
                        >
                            {(other.info?.name as string)?.[0] || 'A'}
                        </div>
                    ))}
                </div>
            )}

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto bg-[#050505] p-6 collab-editor-container custom-scrollbar text-[#e0e0e0]">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .collab-editor-container textarea { outline: none !important; }
                    .collab-editor-container pre { text-shadow: none !important; background: transparent !important; }
                    .collab-editor-container code[class*="language-"], .collab-editor-container pre[class*="language-"] { color: #ccc !important; }
                    .collab-editor-container .token.comment, .collab-editor-container .token.block-comment, .collab-editor-container .token.prolog, .collab-editor-container .token.doctype, .collab-editor-container .token.cdata { color: #999 !important; }
                    .collab-editor-container .token.punctuation { color: #ccc !important; }
                    .collab-editor-container .token.tag, .collab-editor-container .token.attr-name, .collab-editor-container .token.namespace, .collab-editor-container .token.deleted { color: #e2777a !important; }
                    .collab-editor-container .token.function-name { color: #6196cc !important; }
                    .collab-editor-container .token.boolean, .collab-editor-container .token.number, .collab-editor-container .token.function { color: #f08d49 !important; }
                    .collab-editor-container .token.property, .collab-editor-container .token.class-name, .collab-editor-container .token.constant, .collab-editor-container .token.symbol { color: #f8c555 !important; }
                    .collab-editor-container .token.selector, .collab-editor-container .token.important, .collab-editor-container .token.atrule, .collab-editor-container .token.keyword, .collab-editor-container .token.builtin { color: #cc99cd !important; }
                    .collab-editor-container .token.string, .collab-editor-container .token.char, .collab-editor-container .token.attr-value, .collab-editor-container .token.regex, .collab-editor-container .token.variable { color: #7ec699 !important; }
                    .collab-editor-container .token.operator, .collab-editor-container .token.entity, .collab-editor-container .token.url { color: #67cdcc !important; }
                    
                    /* Global Override for Liveblocks Badge */
                    .lb-root, [class*="lb-badge"], div[data-liveblocks-badge], a[href*="liveblocks"], a[href*="liveblocks.io"] { display: none !important; opacity: 0 !important; visibility: hidden !important; width: 0 !important; height: 0 !important; pointer-events: none !important; z-index: -9999 !important; }
                `}} />
                <Editor
                    value={yjsCode}
                    onValueChange={handleCodeChange}
                    highlight={c => {
                        const grammar = Prism.languages[activeLanguage] || Prism.languages.plaintext;
                        return Prism.highlight(c, grammar, activeLanguage);
                    }}
                    padding={15}
                    style={{
                        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                        fontSize: 14,
                        minHeight: '100%'
                    }}
                    className="border border-white/5 rounded-xl shadow-inner bg-[#0a0c10]"
                />
            </div>

            {/* Terminal Output */}
            {output && (
                <div className="h-[300px] bg-background border-t border-white/10 flex flex-col shrink-0 relative shadow-2xl z-20">
                    <div className="flex items-center justify-between px-4 py-2 text-[10px] font-bold text-primary/70 uppercase tracking-widest border-b border-white/5 glass-effect">
                        <div className="flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> Shared Terminal Output</div>
                        <button onClick={() => setOutput(null)} className="hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="p-4 font-mono text-[13px] overflow-auto flex-1">
                        {output.error && <div className="text-red-400 mb-2 font-bold">{output.error}</div>}
                        {output.stderr && <div className="text-red-300/90 mb-2 whitespace-pre-wrap">{output.stderr}</div>}
                        {output.stdout && <div className="text-green-400/90 whitespace-pre-wrap">{output.stdout}</div>}
                        {!output.stdout && !output.stderr && !output.error && <div className="text-muted-foreground italic">Process completed with no output</div>}
                    </div>
                </div>
            )}
        </div>
    );
}
