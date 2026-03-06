import React, { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ChevronDown, ChevronRight, Loader2, Play, Terminal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CostBadge } from "./cost-badge";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-java";
import { MermaidDiagram } from "./mermaid-diagram";

interface MessageBubbleProps {
    role: "user" | "assistant";
    content: string;
    data?: any[]; // For stream data events
    isTyping?: boolean;
    relevancy?: number;
    imagePreview?: string;
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

// Helper to recursively extract pure text from React children
// In Deep mode, ReactMarkdown sometimes passes an array of objects/elements to <code> instead of a raw string
function extractTextFromChildren(children: any): string {
    if (typeof children === 'string' || typeof children === 'number') {
        return String(children);
    }
    if (Array.isArray(children)) {
        return children.map(extractTextFromChildren).join('');
    }
    if (React.isValidElement(children)) {
        const element = children as React.ReactElement<any>;
        return extractTextFromChildren(element.props.children);
    }
    return '';
}

// Extract all fenced code blocks from raw markdown content
function extractAllCodeBlocks(markdown: string): { language: string; code: string }[] {
    const blocks: { language: string; code: string }[] = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
        blocks.push({ language: match[1] || 'plaintext', code: match[2].trim() });
    }
    return blocks;
}

// Merge multiple code blocks (HTML, CSS, JS) into a single runnable HTML document
function mergeCodeBlocksToHtml(blocks: { language: string; code: string }[]): string {
    let htmlParts: string[] = [];
    let cssParts: string[] = [];
    let jsParts: string[] = [];
    let hasFullHtml = false;

    for (const block of blocks) {
        const lang = block.language.toLowerCase();
        if (lang === 'html' || lang === 'xml') {
            // Check if it's a full HTML document or just a snippet
            if (block.code.includes('<!DOCTYPE') || block.code.includes('<html')) {
                hasFullHtml = true;
            }
            htmlParts.push(block.code);
        } else if (lang === 'css') {
            cssParts.push(block.code);
        } else if (['javascript', 'js'].includes(lang)) {
            jsParts.push(block.code);
        } else if (['react', 'jsx', 'tsx'].includes(lang)) {
            // React code — return as-is for the sandbox to handle
            return block.code;
        }
    }

    // If there's a full HTML document, inject CSS and JS into it
    if (hasFullHtml && htmlParts.length > 0) {
        let merged = htmlParts.join('\n');
        if (cssParts.length > 0) {
            const cssInsert = `<style>\n${cssParts.join('\n')}\n</style>`;
            if (merged.includes('</head>')) {
                merged = merged.replace('</head>', `${cssInsert}\n</head>`);
            } else if (merged.includes('<body')) {
                merged = merged.replace('<body', `${cssInsert}\n<body`);
            } else {
                merged = cssInsert + '\n' + merged;
            }
        }
        if (jsParts.length > 0) {
            const jsInsert = `<script>\n${jsParts.join('\n\n')}\n</script>`;
            if (merged.includes('</body>')) {
                merged = merged.replace('</body>', `${jsInsert}\n</body>`);
            } else {
                merged += '\n' + jsInsert;
            }
        }
        return merged;
    }

    // No full HTML doc — build one from scratch
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
${cssParts.join('\n')}
    </style>
</head>
<body>
${htmlParts.join('\n')}
<script>
${jsParts.join('\n\n')}
</script>
</body>
</html>`;
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState<{ stdout: string; stderr: string; error: string; results: any[] } | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    const language = className?.replace("language-", "") || "plaintext";
    const initialCode = extractTextFromChildren(children).replace(/\n$/, '');
    const [code, setCode] = useState(initialCode);

    const isExecutable = language === "python" || language === "py" || language === "javascript" || language === "js" || language === "typescript" || language === "ts" || language === "cpp" || language === "c" || language === "java";
    const isWebBlock = ["html", "css", "javascript", "js", "react", "jsx", "tsx"].includes(language.toLowerCase());

    const handlePreview = () => {
        window.dispatchEvent(
            new CustomEvent("open-preview", {
                detail: { code, language }
            })
        );
    };

    const handleRun = async () => {
        setIsRunning(true);
        setOutput(null);
        try {
            const res = await fetch('/api/run-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code, language })
            });
            const data = await res.json();
            setOutput(data);
        } catch (error: any) {
            setOutput({ stdout: "", stderr: "", error: error.message, results: [] });
        } finally {
            setIsRunning(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleCoCode = () => {
        const roomId = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
        window.dispatchEvent(new CustomEvent("open-collab", {
            detail: { roomId, initialCode: code, language }
        }));
    };

    return (
        <div className="flex flex-col my-6 group/code shadow-2xl rounded-2xl overflow-hidden border border-white/5">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#14151a] text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                    </div>
                    <span className="ml-1">{language}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleCopy} className="flex items-center gap-1.5 hover:text-foreground transition-colors p-1" title="Copy code">
                        {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {isWebBlock && (
                        <button
                            onClick={handlePreview}
                            className="flex items-center gap-1.5 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 px-3 py-1.5 rounded-lg transition-colors border border-fuchsia-500/20 ml-1"
                            title="Interactive Web Preview"
                        >
                            <Play className="w-3 h-3 fill-current" /> Preview Demo
                        </button>
                    )}
                    {isExecutable && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCoCode}
                                className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20"
                                title="Open Collaborative Room"
                            >
                                <Users className="w-3.5 h-3.5" /> Co-Code
                            </button>
                            <button
                                onClick={handleRun}
                                disabled={isRunning}
                                className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-primary/20"
                                title="Execute code in Cloud Sandbox"
                            >
                                {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                                {isRunning ? "Running..." : "Run"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-[#1d1f21] p-2 text-[13px] leading-relaxed m-0 border-none relative overflow-x-auto group/editor custom-scrollbar text-[#e0e0e0]">
                <Editor
                    value={code}
                    onValueChange={code => setCode(code)}
                    highlight={code => {
                        const grammar = Prism.languages[language] || Prism.languages.plaintext;
                        return Prism.highlight(code, grammar, language);
                    }}
                    padding={15}
                    style={{
                        fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                        fontSize: 13,
                        backgroundColor: "transparent",
                    }}
                    textareaClassName="focus:outline-none"
                    className="min-h-[50px]"
                />
            </div>

            {output && (
                <div className="bg-[#02040a] border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                    <div className="bg-[#0a0c14] px-4 py-2 text-[10px] font-bold text-primary/70 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 shadow-inner">
                        <Terminal className="w-3.5 h-3.5" /> Terminal Output
                    </div>
                    <div className="p-4 font-mono text-[12px] overflow-x-auto max-h-[300px] overflow-y-auto">
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

// Ensure CodeBlock reacts to stream updates by updating its local state when children prop changes
// However, since we want it to be editable, we should only sync if the agent is still typing.
// But we don't pass isTyping to CodeBlock. For simplicity, we'll sync whenever the incoming text is DIFFERENT 
// and longer (assuming streaming). A better approach is `useEffect` tracking children.

function CodeBlockWrapper({ className, children, isTyping }: { className?: string; children: React.ReactNode; isTyping?: boolean }) {
    const language = className?.replace("language-", "") || "plaintext";
    const incomingCode = extractTextFromChildren(children).replace(/\n$/, '');
    const [code, setCode] = useState(incomingCode);

    // Sync from stream if agent is actively typing
    useEffect(() => {
        if (isTyping) setCode(incomingCode);
    }, [incomingCode, isTyping]);

    return <CodeBlock className={className} children={code} />;
}

export function MessageBubble({ role, content, data, isTyping, relevancy, imagePreview }: MessageBubbleProps) {
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
        <div className={`flex w-full ${role === "user" ? "justify-end selection-user" : "justify-start selection-assistant"} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
            <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${role === "user" ? "items-end" : "items-start"}`}>

                {/* Thinking Accordion (Deep Mode) */}
                {role === "assistant" && thinkingSteps.length > 0 && (
                    <Accordion type="single" collapsible defaultValue="thinking" className="w-full mb-3 rounded-2xl overflow-hidden border border-primary/10 bg-primary/5 shadow-sm">
                        <AccordionItem value="thinking" className="border-none">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline text-[10px] font-black text-primary/80 uppercase tracking-[0.2em]">
                                <div className="flex items-center gap-4">
                                    <div className="relative flex h-2 w-2">
                                        <div className="animate-ping absolute inset-0 rounded-full bg-primary opacity-50" />
                                        <div className="relative rounded-full h-2 w-2 bg-primary" />
                                    </div>
                                    <span>Agent Internal Logic • {thinkingSteps.length} Ops Executed</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6">
                                <div className="flex flex-col gap-4 text-xs text-muted-foreground/80 border-l-[3px] border-primary/20 pl-6 ml-1 font-mono">
                                    {thinkingSteps.map((step: any, i: number) => (
                                        <div key={i} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                            <span className="font-bold text-primary/30 shrink-0">[{i + 1}]</span>
                                            <span className="flex-1 opacity-80 leading-loose">{step.value}...</span>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}

                {/* Message Content */}
                <div
                    className={`relative group transition-all duration-500 ${role === "user"
                        ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/20 rounded-[1.5rem] rounded-tr-sm px-6 py-3.5 w-fit self-end text-[16px] font-semibold glow-primary border border-white/10 break-words [word-break:break-word]"
                        : processedContent.trim()
                            ? "bg-transparent text-foreground w-full px-2 py-4"
                            : "bg-transparent border-none shadow-none w-full"
                        }`}
                    onDoubleClick={() => {
                        if (role === "assistant") {
                            // Use selected text if any, otherwise use the first chunk of the message
                            const selection = window.getSelection()?.toString()?.trim();
                            const mentionText = selection || content.slice(0, 150);
                            window.dispatchEvent(
                                new CustomEvent("mention-reply", {
                                    detail: { text: mentionText }
                                })
                            );
                        }
                    }}
                    title={role === "assistant" ? "Double-click to reply to this response" : undefined}
                    style={role === "assistant" ? { cursor: "pointer" } : undefined}
                >
                    {processedContent.trim() && (
                        <div className={`${role === "assistant" ? "prose dark:prose-invert" : "whitespace-pre-wrap"} max-w-none break-words`}>
                            {role === "user" ? (
                                <div className="flex flex-col gap-3">
                                    {imagePreview && (
                                        <div className="bg-black/10 rounded-xl overflow-hidden self-end border border-white/10 shadow-sm w-fit max-w-full">
                                            <img src={imagePreview} alt="Attached" className="max-w-full sm:max-w-[400px] max-h-[300px] object-contain block" />
                                        </div>
                                    )}
                                    <span className="break-words leading-relaxed">{processedContent}</span>
                                </div>
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed font-semibold">{children}</p>,
                                        h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-2 text-primary tracking-tight">{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-md font-bold mb-2 mt-4 text-primary/90">{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 text-foreground/90">{children}</h3>,
                                        ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1.5 opacity-90">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1.5 opacity-90">{children}</ol>,
                                        li: ({ children }) => <li className="mb-1">{children}</li>,
                                        pre: ({ children }) => <>{children}</>,
                                        code: ({ children, className }) => {
                                            const isBlock = className?.includes("language-");

                                            if (className === "language-mermaid") {
                                                const diagramCode = extractTextFromChildren(children).trim();
                                                return <MermaidDiagram chart={diagramCode} />;
                                            }

                                            if (isBlock) {
                                                return <CodeBlockWrapper className={className} isTyping={isTyping}>{children}</CodeBlockWrapper>;
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
                                        td: ({ children }) => <td className="px-3 py-2.5 text-foreground/80">{children}</td>,
                                        blockquote: ({ children }) => (
                                            <blockquote className="border-l-4 border-primary/40 bg-muted/30 pl-4 pr-3 py-2 my-3 rounded-r-lg text-[15px] italic text-foreground/80">
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
                                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors break-words [word-break:break-word] max-w-full inline-block">
                                                    {children}
                                                </a>
                                            );
                                        },
                                    }}
                                >
                                    {processedContent}
                                </ReactMarkdown>
                            )}
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

                    {/* Preview Full Project Button (merges all code blocks) */}
                    {role === "assistant" && processedContent.trim() && (() => {
                        const allBlocks = extractAllCodeBlocks(content);
                        const webBlocks = allBlocks.filter(b => ['html', 'css', 'javascript', 'js', 'react', 'jsx', 'tsx', 'xml'].includes(b.language.toLowerCase()));
                        // Only show if there are 2+ web code blocks (meaning the AI split them)
                        if (webBlocks.length >= 2) {
                            return (
                                <div className="mt-4">
                                    <button
                                        onClick={() => {
                                            const mergedHtml = mergeCodeBlocksToHtml(webBlocks);
                                            const lang = webBlocks.some(b => ['react', 'jsx', 'tsx'].includes(b.language.toLowerCase())) ? 'react' : 'html';
                                            window.dispatchEvent(
                                                new CustomEvent("open-preview", {
                                                    detail: { code: mergedHtml, language: lang }
                                                })
                                            );
                                        }}
                                        className="flex items-center gap-2 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-400 px-4 py-2.5 rounded-xl transition-colors border border-fuchsia-500/20 text-xs font-bold uppercase tracking-wide"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        Preview Full Project
                                    </button>
                                </div>
                            );
                        }
                        return null;
                    })()}

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
