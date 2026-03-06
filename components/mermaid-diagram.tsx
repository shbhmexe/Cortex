import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Copy, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MermaidDiagramProps {
    chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgCode, setSvgCode] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Stable ID for the render container
    const id = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`).current;

    const renderTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            securityLevel: "loose",
            fontFamily: "Inter, sans-serif",
        });

        let isMounted = true;

        const renderChart = async () => {
            try {
                let cleanChart = chart.replace(/^```mermaid\s*\n/, '').replace(/\n```$/, '').trim();
                if (!cleanChart) return;

                // Fix common LLM hallucinated syntax for text arrows, e.g. -->|Request|> Node
                cleanChart = cleanChart.replace(/-->\|([^|]+)\|>/g, '-->|$1|');
                cleanChart = cleanChart.replace(/--\|([^|]+)\|>/g, '-->|$1|');

                // Clear state
                if (isMounted) setError(null);

                // We wrap mermaid.render in a try/catch, but mermaid STILL forcefully appends 
                // error SVGs to the body/container. So we must clean up any element it makes.
                const { svg } = await mermaid.render(id, cleanChart);

                if (isMounted) {
                    setSvgCode(svg);
                }
            } catch (err: any) {
                console.error("Mermaid parsing error:", err);
                if (isMounted) {
                    setError(err.message || "Failed to render diagram.");
                }
            } finally {
                // Mermaid creates an SVG with the ID whether it succeeds or fails.
                // If it failed, it's a bomb icon. We remove it from the DOM manually
                // because we handle error UI ourselves in React.
                const injectedSvg = document.getElementById(id);
                if (injectedSvg) {
                    injectedSvg.remove();
                }
            }
        };

        if (chart) {
            // Debounce rendering to prevent spamming while LLM is streaming text
            if (renderTimeout.current) clearTimeout(renderTimeout.current);
            renderTimeout.current = setTimeout(() => {
                renderChart();
            }, 800);
        }

        return () => {
            isMounted = false;
            if (renderTimeout.current) clearTimeout(renderTimeout.current);
        };
    }, [chart, id]);

    const handleCopy = () => {
        navigator.clipboard.writeText(chart);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col my-6 group/mermaid shadow-2xl rounded-2xl overflow-hidden border border-white/5 bg-[#0a0c14]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#14151a] text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    Architecture Diagram (Mermaid)
                </div>
                <div className="flex gap-1 opacity-0 group-hover/mermaid:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white"
                        onClick={handleCopy}
                        title="Copy Source"
                    >
                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </Button>
                </div>
            </div>

            {/* Rendering Area */}
            <div className="p-4 overflow-x-auto overflow-y-hidden flex items-center justify-center min-h-[150px] relative w-full" ref={containerRef}>
                {error ? (
                    <div className="flex flex-col items-center text-red-400 text-xs text-center">
                        <Info className="w-5 h-5 mb-2" />
                        <div>Syntax Error in Diagram String</div>
                        <div className="mt-2 p-2 bg-red-500/10 rounded font-mono text-[10px] whitespace-pre-wrap max-w-full text-left">
                            {error}
                        </div>
                    </div>
                ) : svgCode ? (
                    <div
                        dangerouslySetInnerHTML={{ __html: svgCode }}
                        className="mermaid-wrapper w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto !text-white"
                    />
                ) : (
                    <div className="animate-pulse text-muted-foreground text-xs flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                        Rendering Diagram...
                    </div>
                )}
            </div>
        </div>
    );
}
