import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

interface CostBadgeProps {
    cost: number | null;
}

export function CostBadge({ cost }: CostBadgeProps) {
    if (cost === null || cost === undefined) return null;

    return (
        <Badge variant="outline" className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <DollarSign className="w-3 h-3" />
            {cost.toFixed(4)}
        </Badge>
    );
}
