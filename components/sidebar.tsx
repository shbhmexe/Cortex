"use client";

import { useEffect, useState } from "react";
import { useSessionId } from "@/hooks/use-session-id";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { History, Menu, Trash2, Github, FolderGit2, Loader2, Folder, ChevronRight, ArrowLeft, FileText, Upload } from "lucide-react";
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
    onRepoIngested?: (repoName: string) => void;
    onDocIngested?: (docName: string) => void;
    historyRefreshKey?: number;
    activeId?: string;
}

export function Sidebar({ onSelectHistory, onDeleteHistory, onRepoIngested, onDocIngested, historyRefreshKey, activeId }: SidebarProps) {
    const { sessionId } = useSessionId();
    const { data: session } = useSession();
    const [history, setHistory] = useState<any[]>([]);

    // If the user's name or image comes from GitHub, or we manually set a flag
    // In a real app we'd check the linked accounts in the DB.
    // For MVP, if they have an image (GitHub provides one, Credentials doesn't by default), we assume GitHub connected.
    const isGithubConnected = !!session?.user?.image || session?.user?.name?.includes("github");

    const [repoInput, setRepoInput] = useState("");
    const [isIngesting, setIsIngesting] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [userRepos, setUserRepos] = useState<any[]>([]);
    const [isLoadingRepos, setIsLoadingRepos] = useState(false);
    const [hasTokenError, setHasTokenError] = useState(false);
    // Drill-down state
    const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
    const [subFolders, setSubFolders] = useState<{ name: string; path: string }[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = useState(false);

    useEffect(() => {
        if (isDialogOpen && isGithubConnected && userRepos.length === 0) {
            const fetchRepos = async () => {
                setIsLoadingRepos(true);
                setHasTokenError(false);
                try {
                    const token = (session as any)?.accessToken;
                    if (!token) {
                        setHasTokenError(true);
                        return;
                    }

                    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: "application/vnd.github.v3+json",
                        }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setUserRepos(data);
                    }
                } catch (e) {
                    console.error("Failed to fetch repos", e);
                } finally {
                    setIsLoadingRepos(false);
                }
            };
            fetchRepos();
        }
    }, [isDialogOpen, isGithubConnected, session]);

    const handleConnectGithub = () => {
        signIn("github");
    };

    const handleReconnect = async () => {
        await signOut({ redirect: false });
        signIn("github");
    };

    const handleOpenRepo = async (repoFullName: string) => {
        const token = (session as any)?.accessToken;
        if (!token) { setHasTokenError(true); return; }

        setExpandedRepo(repoFullName);
        setSubFolders([]);
        setIsLoadingFolders(true);

        try {
            const res = await fetch(`https://api.github.com/repos/${repoFullName}/contents`, {
                headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
            });
            if (res.ok) {
                const data = await res.json();
                const dirs = (data as any[]).filter((item: any) => item.type === "dir");
                if (dirs.length === 0) {
                    // Repo has no sub-folders, ingest the whole repo
                    await executeIngestion(repoFullName);
                    setExpandedRepo(null);
                } else {
                    setSubFolders(dirs.map((d: any) => ({ name: d.name, path: d.path })));
                }
            } else {
                toast.error("Failed to fetch repo contents");
                setExpandedRepo(null);
            }
        } catch {
            toast.error("Network error fetching repo contents");
            setExpandedRepo(null);
        } finally {
            setIsLoadingFolders(false);
        }
    };

    const executeIngestion = async (targetRepo: string) => {
        if (!targetRepo) {
            toast.error("Please enter a repository name");
            return;
        }

        try {
            setRepoInput(targetRepo);
            setIsIngesting(true);
            toast.info(`Starting ingestion for ${targetRepo}... This may take a minute.`);

            const token = (session as any)?.accessToken;
            if (!token) {
                toast.error("Missing GitHub Token. Please reconnect your account.");
                setIsIngesting(false);
                return;
            }

            const res = await fetch("/api/github/ingest", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ repository: targetRepo })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(data.message || `Successfully analyzed ${targetRepo}`);
                onRepoIngested?.(targetRepo);
                setIsDialogOpen(false);
                setExpandedRepo(null);
                setSubFolders([]);
                setRepoInput("");
            } else {
                toast.error(data.error || "Failed to analyze repository");
            }
        } catch (error) {
            toast.error("Network error while trying to analyze repo");
        } finally {
            setIsIngesting(false);
        }
    };

    const handleRepoAnalysis = async (e: React.FormEvent) => {
        e.preventDefault();
        await executeIngestion(repoInput);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingDoc(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload-doc", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Upload failed");
            }

            toast.success("Document added to Knowledge Base!");
            onDocIngested?.(file.name); // Notify parent to show banner
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsUploadingDoc(false);
            e.target.value = ""; // Reset input
        }
    };

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/history`);
                if (res.ok) {
                    const data = await res.json();
                    // Group by sessionId — show only the FIRST query per session
                    // This prevents follow-up queries from appearing as separate entries
                    const sessionMap = new Map<string, any>();
                    // data is sorted newest-first, so iterate in reverse to keep the FIRST (oldest) query per session
                    const reversed = [...data].reverse();
                    for (const item of reversed) {
                        const sid = item.sessionId;
                        if (sid && !sessionMap.has(sid)) {
                            sessionMap.set(sid, item);
                        }
                    }
                    // Convert back to array sorted newest-first
                    const grouped = Array.from(sessionMap.values()).sort(
                        (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );
                    setHistory(grouped);
                }
            } catch (error) {
                console.error("Failed to fetch history:", error);
            }
        };

        fetchHistory();
    }, [sessionId, historyRefreshKey]);

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
        <div className="w-[300px] md:w-[320px] border-r border-white/5 bg-background/20 backdrop-blur-3xl flex flex-col h-full hidden lg:flex relative z-20">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
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
                                className={`w-full flex items-center gap-4 text-left p-4 rounded-2xl transition-all duration-300 group animate-in fade-in slide-in-from-left-2 cursor-pointer relative overflow-hidden ${item.id === activeId
                                    ? "bg-primary/10 border-white/10 glow-primary scale-[1.02]"
                                    : "hover:bg-white/5 border-transparent"}`}
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
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${item.mode === 'deep'
                                            ? 'bg-primary/20 text-primary'
                                            : 'bg-orange-500/20 text-orange-500'
                                            }`}>
                                            {item.mode === 'deep' ? 'Deep' : 'Quick'}
                                        </span>
                                        <button
                                            onClick={(e) => handleDelete(e, item.id)}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Delete research"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            <div className="p-6 border-t border-white/5 space-y-4">
                {isGithubConnected ? (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-primary/70 uppercase tracking-widest px-1">
                            Smart RAG Context
                        </div>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    className="w-full justify-start gap-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)] transition-all"
                                >
                                    <FolderGit2 className="w-4 h-4" />
                                    Repo Analysis
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md bg-background/80 backdrop-blur-2xl border-white/10">
                                <DialogHeader>
                                    <DialogTitle>Analyze GitHub Repository</DialogTitle>
                                    <DialogDescription>
                                        Enter the full name of the repository (e.g. <code>facebook/react</code>) to inject its AST tree into the Agent's Smart RAG.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex flex-col gap-4 mt-4">
                                    {hasTokenError ? (
                                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3 bg-red-500/10 rounded-xl border border-red-500/20 px-4">
                                            <p className="text-sm text-red-400">Your session needs an update to fetch repositories.</p>
                                            <Button onClick={handleReconnect} className="bg-red-500 hover:bg-red-600 text-white h-8 text-xs">
                                                Reconnect GitHub
                                            </Button>
                                        </div>
                                    ) : expandedRepo ? (
                                        /* === FOLDER DRILL-DOWN VIEW === */
                                        <div className="flex flex-col gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setExpandedRepo(null); setSubFolders([]); }}
                                                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
                                            >
                                                <ArrowLeft className="w-3 h-3" />
                                                <span>Back to repos</span>
                                            </button>
                                            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 mb-1">
                                                <FolderGit2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span className="text-xs font-bold text-primary truncate">{expandedRepo}</span>
                                            </div>
                                            {isLoadingFolders ? (
                                                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                                            ) : (
                                                <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-background">
                                                    {/* Whole repo option */}
                                                    <button
                                                        type="button"
                                                        onClick={() => executeIngestion(expandedRepo)}
                                                        disabled={isIngesting}
                                                        className="w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-primary/20 hover:text-primary text-foreground/80 border border-dashed border-border transition-colors mb-1"
                                                    >
                                                        <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="font-semibold">Ingest entire repo</span>
                                                    </button>
                                                    {subFolders.map(folder => (
                                                        <button
                                                            key={folder.path}
                                                            type="button"
                                                            onClick={() => executeIngestion(`${expandedRepo}/${folder.path}`)}
                                                            disabled={isIngesting}
                                                            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors hover:bg-muted text-foreground/80 ${isIngesting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <Folder className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                                                            <div>
                                                                <div className="font-semibold text-foreground">{folder.name}</div>
                                                                <div className="text-[10px] text-muted-foreground">{folder.path}</div>
                                                            </div>
                                                            <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground/50" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : isLoadingRepos ? (
                                        /* === LOADING REPOS VIEW === */
                                        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                                    ) : userRepos.length > 0 ? (
                                        /* === REPO LIST VIEW === */
                                        <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-background">
                                            {userRepos.map(repo => (
                                                <button
                                                    key={repo.id}
                                                    type="button"
                                                    onClick={() => setRepoInput(repo.full_name)}
                                                    onDoubleClick={() => handleOpenRepo(repo.full_name)}
                                                    disabled={isIngesting}
                                                    className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${repoInput === repo.full_name ? 'bg-primary/20 text-primary border border-primary/30' : 'hover:bg-muted text-foreground/80'} ${isIngesting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    title="Single click to select, double-click to explore folders"
                                                >
                                                    <FolderGit2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-foreground truncate">{repo.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{repo.full_name}</div>
                                                    </div>
                                                    {repoInput === repo.full_name && (
                                                        <span className="text-[8px] text-primary/70 uppercase tracking-wider font-bold ml-auto shrink-0">Selected</span>
                                                    )}
                                                    <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="text-xs text-muted-foreground text-center">Or enter repository manually:</div>
                                    <form onSubmit={handleRepoAnalysis} className="flex flex-col gap-4">
                                        <Input
                                            placeholder="owner/repo"
                                            value={repoInput}
                                            onChange={(e) => setRepoInput(e.target.value)}
                                            className="bg-background border-border"
                                            disabled={isIngesting}
                                        />
                                        <Button type="submit" disabled={isIngesting} className="w-full bg-primary text-primary-foreground">
                                            {isIngesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderGit2 className="w-4 h-4 mr-2" />}
                                            {isIngesting ? "Indexing Files..." : "Ingest Repository"}
                                        </Button>
                                    </form>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <p className="text-[10px] text-muted-foreground text-center">GitHub Connected</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground/50 uppercase tracking-widest px-1">
                            Unlock RAG Context
                        </div>
                        <Button
                            onClick={handleConnectGithub}
                            variant="secondary"
                            className="w-full justify-start gap-3 bg-muted/50 hover:bg-muted text-foreground border border-border backdrop-blur-md transition-all"
                        >
                            <Github className="w-4 h-4" />
                            Connect GitHub
                        </Button>
                    </div>
                )}

                {/* === INTERNAL DOCS RAG UPLOAD === */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary/70 uppercase tracking-widest px-1">
                        Internal Docs
                    </div>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".pdf,.txt,.md"
                            onChange={handleFileUpload}
                            disabled={isUploadingDoc}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                            title="Upload PDF, MD or TXT"
                        />
                        <Button
                            variant="secondary"
                            className="w-full justify-start gap-3 bg-muted/30 hover:bg-muted/50 text-foreground border border-border backdrop-blur-md transition-all relative overflow-hidden"
                            disabled={isUploadingDoc}
                        >
                            {isUploadingDoc ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : (
                                <FileText className="w-4 h-4" />
                            )}
                            <span className="truncate">{isUploadingDoc ? "Parsing Document..." : "Upload Document"}</span>
                            <Upload className="w-3.5 h-3.5 ml-auto opacity-50 shrink-0" />
                        </Button>
                    </div>
                </div>
            </div>
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
