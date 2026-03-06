import { Sparkles, Zap, BrainCircuit } from "lucide-react";

interface ModelSelectorProps {
    selectedModel: string;
    onModelChange: (model: string) => void;
}

const models = [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "High Performance", icon: BrainCircuit, color: "text-blue-400" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", description: "Latest & Fast", icon: Sparkles, color: "text-purple-400" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", description: "Fastest", icon: Zap, color: "text-orange-400" },
];

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
    const activeModel = models.find(m => m.id === selectedModel) ?? models[0];
    const Icon = activeModel.icon;

    return (
        <div className="relative flex items-center group/ms shrink-0">
            <div className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10`}>
                <Icon className={`w-3.5 h-3.5 ${activeModel.color}`} />
            </div>
            <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="appearance-none bg-transparent pl-7 pr-5 py-1 text-[11px] font-semibold text-foreground/70 hover:text-foreground outline-none cursor-pointer transition-colors relative z-10 max-w-[130px]"
            >
                {models.map(m => (
                    <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-100">
                        {m.name}
                    </option>
                ))}
            </select>
            {/* chevron */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </div>
        </div>
    );
}
