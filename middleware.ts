import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const isLoggedIn = !!req.auth;
    const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
    const isApiRoute = req.nextUrl.pathname.startsWith("/api");

    // Allow API routes and auth pages
    if (isApiRoute || isAuthPage) {
        return NextResponse.next();
    }

    // Redirect to signin if not logged in
    if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
