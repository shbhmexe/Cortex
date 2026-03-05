import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
    const isApiRoute = req.nextUrl.pathname.startsWith("/api");

    // Allow API routes and auth pages through without auth check
    if (isApiRoute || isAuthPage) {
        return NextResponse.next();
    }

    // For all other routes, check authentication
    const session = await auth();
    if (!session) {
        return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png).*)"],
};
