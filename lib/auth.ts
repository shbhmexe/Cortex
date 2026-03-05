import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import bcrypt from "bcryptjs";

// Simple in-memory user store for hackathon
// In production, use a database like Prisma + PostgreSQL
const users: { id: string; email: string; password: string; name: string }[] = [];

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
            authorization: { params: { scope: "read:user user:email repo" } },
        }),
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                name: { label: "Name", type: "text" },
                isSignUp: { label: "Is Sign Up", type: "text" },
            },
            async authorize(credentials) {
                const email = credentials?.email as string;
                const password = credentials?.password as string;
                const name = credentials?.name as string;
                const isSignUp = credentials?.isSignUp === "true";

                if (!email || !password) {
                    throw new Error("Email and password are required");
                }

                if (isSignUp) {
                    // Sign Up Flow
                    const existingUser = users.find((u) => u.email === email);
                    if (existingUser) {
                        throw new Error("User already exists");
                    }

                    const hashedPassword = await bcrypt.hash(password, 10);
                    const newUser = {
                        id: crypto.randomUUID(),
                        email,
                        password: hashedPassword,
                        name: name || email.split("@")[0],
                    };
                    users.push(newUser);

                    return { id: newUser.id, email: newUser.email, name: newUser.name };
                } else {
                    // Sign In Flow
                    const user = users.find((u) => u.email === email);
                    if (!user) {
                        throw new Error("Invalid credentials");
                    }

                    const isValidPassword = await bcrypt.compare(password, user.password);
                    if (!isValidPassword) {
                        throw new Error("Invalid credentials");
                    }

                    return { id: user.id, email: user.email, name: user.name };
                }
            },
        }),
    ],
    pages: {
        signIn: "/auth/signin",
    },
    callbacks: {
        async jwt({ token, user, account }) {
            if (user) {
                token.id = user.id;
            }
            if (account && account.provider === "github") {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session as any).accessToken = token.accessToken;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
    },
});
