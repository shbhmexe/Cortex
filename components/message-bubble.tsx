import { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CostBadge } from "./cost-badge";

interface MessageBubbleProps {
    role: "user" | "assistant";
    content: string;
    data?: any[]; // For stream data events
    isTyping?: boolean;
    relevancy?: number;
}

function Citation({ url, index }: { url: string; index: number }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-blue-500 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors mx-0.5 -translate-y-0.5"
        >
            {index}
        </a>
    );
}

export function MessageBubble({ role, content, data, isTyping, relevancy }: MessageBubbleProps) {
    const [copied, setCopied] = useState(false);
    const [displayedContent, setDisplayedContent] = useState(
        role === "assistant" && isTyping ? "" : content
    );
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Simulated Typewriter logic
    useEffect(() => {
        if (role === "user") {
            setDisplayedContent(content);
            return;
        }

        // If it's an assistant message, we catch up to the target content
        if (displayedContent.length < content.length) {
            if (timerRef.current) clearInterval(timerRef.current);

            timerRef.current = setInterval(() => {
                setDisplayedContent(prev => {
                    if (prev.length < content.length) {
                        // Calculate step size - faster if we are far behind
                        const diff = content.length - prev.length;
                        const step = diff > 50 ? 5 : 1;
                        return content.slice(0, prev.length + step);
                    }
                    if (timerRef.current) clearInterval(timerRef.current);
                    return prev;
                });
            }, 15);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [content, role]);

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Extract thinking steps and cost from data
    const flatData = data?.flatMap((d: any) => Array.isArray(d) ? d : [d]) || [];
    const thinkingSteps = flatData.filter((d: any) => d.type === "thinking");
    const costItem = flatData.find((d: any) => d.type === "cost");
    const relevancyFromStream = flatData.find((d: any) => d.type === "relevancy")?.value;

    // Priority: prop (from history) > stream data (live)
    const effectiveRelevancy = relevancy !== undefined ? relevancy : relevancyFromStream;

    // Regex for [[url]]
    const citationRegex = /\[\[(.*?)\]\]/g;

    // Custom renderer for ReactMarkdown to handle textual citations if we wanted to replace logic, but 
    // replacing text before render is easier for unique React components? 
    // Let's use a custom component for text? No, complex.
    // We'll preprocess the content to replace [[url]] with [index](url) standard markdown 
    // OR we use a custom plugin.

    // Simplest approach: Replace [[url]] with a unique marker, then render?
    // Or just typical markdown link [index](url) and style it?

    // Let's find all unique URLs first to number them sequentially
    const citations: string[] = [];

    // Step 1: Extract URLs from [[url]] markers (filter out non-URLs like [[1]], [[2]])
    let processedContent = displayedContent.replace(citationRegex, (match, url) => {
        const trimmedUrl = url.trim();
        // Only treat as citation if it looks like a URL
        if (!/^https?:\/\//i.test(trimmedUrl)) {
            return match; // Leave non-URL markers as-is
        }
        let index = citations.indexOf(trimmedUrl);
        if (index === -1) {
            citations.push(trimmedUrl);
            index = citations.length - 1;
        }
        return `[${index + 1}](${trimmedUrl})`;
    });

    // Step 2: Also collect URLs from standard markdown links [text](url) that aren't already in citations
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = markdownLinkRegex.exec(processedContent)) !== null) {
        const linkUrl = linkMatch[2].trim();
        if (citations.indexOf(linkUrl) === -1) {
            citations.push(linkUrl);
        }
    }

    return (
        <div className={`flex w-full ${role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${role === "user" ? "items-end" : "items-start"}`}>

                {/* Thinking Accordion (Deep Mode) */}
                {role === "assistant" && thinkingSteps.length > 0 && (
                    <Accordion type="single" collapsible defaultValue="thinking" className="w-full mb-3 rounded-2xl overflow-hidden border border-primary/10 bg-primary/5 shadow-sm">
                        <AccordionItem value="thinking" className="border-none">
                            <AccordionTrigger className="px-5 py-3 hover:no-underline text-xs font-semibold text-primary/70 uppercase tracking-wider">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </div>
                                    <span>Agent Logic • {thinkingSteps.length} Steps</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-5 pb-4">
                                <div className="flex flex-col gap-3 text-xs text-muted-foreground border-l-2 border-primary/20 pl-4 ml-1">
                                    {thinkingSteps.map((step: any, i: number) => (
                                        <div key={i} className="flex gap-3 leading-relaxed">
                                            <span className="font-bold text-primary/40">0{i + 1}</span>
                                            <span className="flex-1 italic">{step.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}

                {/* Message Content */}
                <div
                    className={`relative group transition-all duration-300 ${role === "user"
                        ? "bg-gradient-to-br from-primary/80 to-blue-600/80 text-white shadow-md rounded-2xl rounded-tr-none px-5 py-3 w-fit self-end text-[14px] border border-white/10"
                        : processedContent.trim()
                            ? "bg-card/40 backdrop-blur-xl border border-border/40 text-card-foreground shadow-xl rounded-[24px] w-full px-5 py-4"
                            : "bg-transparent border-none shadow-none w-full"
                        }`}
                >
                    {processedContent.trim() && (
                        <div className={`${role === "assistant" ? "prose dark:prose-invert" : ""} max-w-none break-words selection:bg-primary/30`}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    p: ({ children }) => <p className={`${role === "assistant" ? "mb-3 last:mb-0" : "m-0"} leading-relaxed font-semibold`}>{children}</p>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-2 text-primary tracking-tight">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-md font-bold mb-2 mt-4 text-primary/90">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 text-foreground/90">{children}</h3>,
                                    ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5 opacity-90">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 opacity-90">{children}</ol>,
                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                    pre: ({ children }) => (
                                        <pre className="bg-[#0d1117] text-[#c9d1d9] rounded-xl p-4 my-3 overflow-x-auto text-xs leading-relaxed border border-white/5 shadow-lg">
                                            {children}
                                        </pre>
                                    ),
                                    code: ({ children, className }) => {
                                        const isBlock = className?.includes("language-");
                                        if (isBlock) {
                                            return <code className={`${className} font-mono text-xs`}>{children}</code>;
                                        }
                                        return <code className="bg-muted/50 px-1.5 py-0.5 rounded-md font-mono text-xs border border-border/30">{children}</code>;
                                    },
                                    table: ({ children }) => (
                                        <div className="overflow-x-auto my-4 rounded-xl border border-border/30 shadow-sm">
                                            <table className="w-full text-xs border-collapse">{children}</table>
                                        </div>
                                    ),
                                    thead: ({ children }) => <thead className="bg-muted/40 border-b border-border/30">{children}</thead>,
                                    tbody: ({ children }) => <tbody className="divide-y divide-border/20">{children}</tbody>,
                                    tr: ({ children }) => <tr className="hover:bg-muted/20 transition-colors">{children}</tr>,
                                    th: ({ children }) => <th className="px-3 py-2.5 text-left font-bold text-foreground/80 uppercase tracking-wider text-[10px]">{children}</th>,
                                    td: ({ children }) => <td className="px-3 py-2.5 text-foreground/70">{children}</td>,
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-3 border-primary/40 bg-primary/5 pl-4 pr-3 py-2 my-3 rounded-r-xl text-sm italic text-foreground/70">
                                            {children}
                                        </blockquote>
                                    ),
                                    a: ({ href, children }) => {
                                        const text = String(children);
                                        // Check if it's a citation link (single/double digit number)
                                        if (/^\d{1,2}$/.test(text.trim())) {
                                            return (
                                                <a
                                                    href={href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center justify-center w-[18px] h-[18px] text-[9px] font-bold text-blue-500 bg-blue-500/15 rounded-full hover:bg-blue-500/30 hover:scale-110 transition-all mx-0.5 -translate-y-1 cursor-pointer no-underline"
                                                    title={href}
                                                >
                                                    {text}
                                                </a>
                                            );
                                        }
                                        // Normal links
                                        return (
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                                                {children}
                                            </a>
                                        );
                                    },
                                }}
                            >
                                {processedContent}
                            </ReactMarkdown>
                            {isTyping && (
                                <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse rounded-full" />
                            )}
                        </div>
                    )}

                    {/* Render Citations List */}
                    {citations.length > 0 && processedContent.trim() && (
                        <div className="mt-5 pt-4 border-t border-border/10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-0.5 w-4 bg-primary/30 rounded-full" />
                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Validated Sources</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {citations.map((url, i) => (
                                    <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/20 border border-border/10 hover:border-primary/30 hover:bg-primary/10 transition-all text-[10px] group/cite"
                                    >
                                        <span className="w-5 h-5 flex items-center justify-center rounded-lg bg-primary/20 text-primary font-bold text-[9px] group-hover/cite:scale-110 transition-transform">
                                            {i + 1}
                                        </span>
                                        <span className="truncate flex-1 font-medium opacity-70 group-hover/cite:opacity-100 transition-opacity">{url}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Meta Info & Actions (Assistant Only) */}
                    {role === "assistant" && processedContent.trim() && (
                        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border/10">
                            {/* Relevancy Bar */}
                            {effectiveRelevancy !== undefined && (
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Relevancy</span>
                                    <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden max-w-[200px]">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${effectiveRelevancy}%`,
                                                background: effectiveRelevancy >= 80
                                                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                                    : effectiveRelevancy >= 50
                                                        ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                                                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                                            }}
                                        />
                                    </div>
                                    <span className={`text-[11px] font-bold ${effectiveRelevancy >= 80 ? 'text-green-500' :
                                        effectiveRelevancy >= 50 ? 'text-yellow-500' : 'text-red-500'
                                        }`}>
                                        {effectiveRelevancy}%
                                    </span>
                                </div>
                            )}

                            {/* Cost & Copy */}
                            <div className="flex items-center justify-between gap-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <CostBadge cost={costItem?.value} />
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                        onClick={handleCopy}
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
