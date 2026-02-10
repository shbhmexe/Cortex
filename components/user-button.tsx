"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function UserButton() {
    const { data: session } = useSession();

    if (!session?.user) return null;

    return (
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                    {session.user.name || session.user.email?.split("@")[0]}
                </span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            >
                <LogOut className="w-4 h-4" />
            </Button>
        </div>
    );
}
