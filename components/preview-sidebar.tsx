"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Code, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { WebSandbox } from "./web-sandbox";

export function PreviewSidebar() {
    const [isOpen, setIsOpen] = useState(false);
    const [code, setCode] = useState("");
    const [language, setLanguage] = useState("");
    const [isExpanded, setIsExpanded] = useState(false); // To toggle full width vs sidebar

    useEffect(() => {
        const handleOpenPreview = (event: CustomEvent<{ code: string; language: string }>) => {
            setCode(event.detail.code);
            setLanguage(event.detail.language);
            setIsOpen(true);
        };

        window.addEventListener("open-preview" as any, handleOpenPreview);
        return () => window.removeEventListener("open-preview" as any, handleOpenPreview);
    }, []);

    // Also close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
                setIsExpanded(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                    />

                    {/* Sidebar Panel */}
                    <motion.div
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className={`fixed top-0 right-0 h-full bg-[#0a0c10] border-l border-white/10 z-50 flex flex-col shadow-2xl transition-all duration-300 ease-in-out ${isExpanded ? 'w-[95vw] md:w-[90vw]' : 'w-[90vw] md:w-[600px] lg:w-[800px]'}`}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#14151a]">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-blue-500/20 rounded-md text-blue-400">
                                    <Code className="w-5 h-5" />
                                </div>
                                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                                    Live Preview Sandbox
                                </h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10 ml-2">
                                    {language.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        // Open in actual new tab by creating a blob
                                        const blob = new Blob([code], { type: 'text/html' });
                                        window.open(URL.createObjectURL(blob), '_blank');
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors group"
                                    title="Open raw code (HTML only)"
                                >
                                    <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                </button>
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white transition-colors group hidden md:block"
                                    title={isExpanded ? "Collapse Sidebar" : "Expand to Full Screen"}
                                >
                                    {isExpanded ? (
                                        <Minimize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    ) : (
                                        <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    )}
                                </button>
                                <div className="w-px h-5 bg-white/10 mx-1" />
                                <button
                                    onClick={() => { setIsOpen(false); setIsExpanded(false); }}
                                    className="p-2 hover:bg-red-500/20 rounded-lg text-muted-foreground hover:text-red-400 transition-colors group"
                                    title="Close Preview"
                                >
                                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* Sandbox Container */}
                        <div className="flex-1 p-4 overflow-hidden relative bg-[url('/grid.svg')] bg-center">
                            <WebSandbox code={code} language={language} />
                        </div>
                    </motion.div>
                </>
            )
            }
        </AnimatePresence >
    );
}
