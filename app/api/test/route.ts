import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ status: "ok", method: "GET" });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({ status: "ok", method: "POST", body });
}
