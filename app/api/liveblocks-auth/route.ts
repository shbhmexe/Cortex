import { Liveblocks } from "@liveblocks/node";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const secretKey = process.env.LIVEBLOCKS_SECRET_KEY;
        if (!secretKey) {
            return NextResponse.json(
                { error: "LIVEBLOCKS_SECRET_KEY is not configured" },
                { status: 500 }
            );
        }

        const liveblocks = new Liveblocks({ secret: secretKey });
        const { room } = await request.json();

        // In a real app, you would check if the user is allowed to join this room.
        // For this hackathon feature, any random user can join if they have the 6-digit code.
        const userId = `user_${Math.floor(Math.random() * 10000)}`;

        const session = liveblocks.prepareSession(userId, {
            userInfo: {
                name: `Anonymous Collaborator ${userId.slice(5)}`,
                color: ["#ff9b9b", "#9bffff", "#9bff9b", "#ffff9b", "#ff9bff"][Math.floor(Math.random() * 5)]
            }
        });

        session.allow(room, session.FULL_ACCESS);
        const { status, body } = await session.authorize();

        return new NextResponse(body, { status });
    } catch (error: any) {
        console.error("Liveblocks Auth Error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to authorize Liveblocks session" },
            { status: 500 }
        );
    }
}
