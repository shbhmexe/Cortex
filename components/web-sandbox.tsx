"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface WebSandboxProps {
    code: string;
    language: "html" | "css" | "javascript" | "react" | "js" | "jsx" | "tsx" | "plaintext" | string;
}

export function WebSandbox({ code, language }: WebSandboxProps) {
    const [iframeKey, setIframeKey] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isReact = ["react", "jsx", "tsx"].includes(language.toLowerCase());
    const isHtml = ["html", "xml"].includes(language.toLowerCase());

    const refreshSandbox = () => {
        setIsLoading(true);
        setIframeKey((prev) => prev + 1);
    };

    const getHtmlDoc = () => {
        // Safe document structure for executing code
        let htmlContent = code;

        if (isReact) {
            // For React code, we inject React + ReactDOM + Babel via CDN
            // We strip any outer markdown or imports that might break standard babel standalone
            const cleanedCode = code
                .replace(/^import.*from.*$/gm, '') // Remove standard ES modules since we use UMD
                .replace(/^export default /gm, 'const App = ') // Convert export default to App component
                .replace(/^export /gm, ''); // Remove other exports

            // Only append React DOM render if the AI didn't already include it
            const renderCode = cleanedCode.includes("createRoot") || cleanedCode.includes("ReactDOM.render")
                ? cleanedCode
                : `${cleanedCode}\n\nconst root = ReactDOM.createRoot(document.getElementById('root'));\nroot.render(<App />);`;

            htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Tailwind via CDN for styling -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- React & ReactDOM -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <!-- Babel for JSX compilation -->
    <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: transparent; color: white; margin: 0; padding: 1rem; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" data-type="module">
        ${renderCode}
    </script>
</body>
</html>`;
        } else if (!isHtml) {
            // If it's pure JS or pure CSS without HTML boilerplate
            if (language.toLowerCase() === "css") {
                htmlContent = `<style>${code}</style><div>CSS Applied. Inspect element or apply HTML.</div>`;
            } else if (language.toLowerCase() === "javascript" || language.toLowerCase() === "js") {
                htmlContent = `
<!DOCTYPE html>
<html>
<head><style>body { color: white; font-family: monospace; }</style></head>
<body>
    <div id="output"></div>
    <script>
        const originalLog = console.log;
        console.log = function(...args) {
            document.getElementById('output').innerHTML += args.join(' ') + '<br/>';
            originalLog.apply(console, args);
        };
        try {
            ${code}
        } catch(e) {
            console.error(e);
            document.getElementById('output').innerHTML += '<span style="color:red">' + e.toString() + '</span>';
        }
    </script>
</body>
</html>`;
            }
        }

        // Add tailwind to raw HTML blocks if missing
        if (isHtml && !htmlContent.includes("tailwind")) {
            htmlContent = htmlContent.replace('<head>', '<head>\n<script src="https://cdn.tailwindcss.com"></script>');
        }

        return htmlContent;
    };

    return (
        <div className="w-full flex-1 flex flex-col relative h-full rounded-lg overflow-hidden border border-white/10 bg-black">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c10] z-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
            )}

            <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={getHtmlDoc()}
                title="Code Sandbox"
                sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
                className="w-full h-full border-none bg-white/5"
                onLoad={() => setIsLoading(false)}
            />

            <button
                onClick={refreshSandbox}
                className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-md text-white/70 hover:text-white transition-colors z-20 border border-white/10"
                title="Restart execution"
            >
                <RefreshCw className="w-4 h-4" />
            </button>
        </div>
    );
}
