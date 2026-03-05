import { NextRequest, NextResponse } from "next/server";
import { fetchGithubTree, filterRelevantFiles, downloadGithubFile } from "@/lib/github";
import { auth } from "@/lib/auth";
import { qdrantClient, COLLECTIONS } from "@/lib/qdrant";
import { pipeline } from "@huggingface/transformers";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // WARNING: In a production app, the GitHub Access Token would be persisted
        // and retrieved from the Database after OAuth signup.
        // For this hackathon, we are mocking the token access since NextAuth
        // by default does not expose the raw provider 'access_token' to the client session
        // without a custom JWT callback that saves the token to the DB.
        const accessToken = req.headers.get("Authorization")?.replace("Bearer ", "");
        if (!accessToken) {
            return NextResponse.json({ error: "GitHub Access Token Required in headers" }, { status: 400 });
        }

        const { repository, branch = "main" } = await req.json();

        if (!repository) {
            return NextResponse.json({ error: "Repository name required (e.g. facebook/react)" }, { status: 400 });
        }

        const parts = repository.split('/');
        if (parts.length < 2) {
            return NextResponse.json({ error: "Invalid repository format" }, { status: 400 });
        }

        const ownerRepo = `${parts[0]}/${parts[1]}`;
        const subPath = parts.length > 2 ? parts.slice(2).join('/') : "";

        console.log(`[RAG] Starting ingestion for ${ownerRepo}@${branch} ${subPath ? `in path /${subPath}` : ""}`);

        // 1. Fetch entire repo tree (recursive)
        const tree = await fetchGithubTree(ownerRepo, branch, accessToken);

        // 2. Filter out heavy/unnecessary files and match subPath
        let filesToProcess = filterRelevantFiles(tree);
        if (subPath) {
            filesToProcess = filesToProcess.filter(file => file.path.startsWith(`${subPath}/`));
        }

        console.log(`[RAG] Found ${filesToProcess.length} relevant files out of ${tree.length} total.`);

        if (filesToProcess.length === 0) {
            return NextResponse.json({ message: "No supported code files found in repository." });
        }

        // Limit to 50 files for safety/cost during hackathon
        const MAX_FILES = 50;
        const targetFiles = filesToProcess.slice(0, MAX_FILES);

        // 3. Download and Chunk files
        const documents = [];
        for (const file of targetFiles) {
            try {
                // To avoid rate-limits, we download sequentially. 
                // For prod, use a queue like BullMQ.
                const content = await downloadGithubFile(ownerRepo, branch, file.path, accessToken);

                // Extremely simple chunking strategy for hackathon
                // 1 chunk = 1 file (if small), or just truncating for extremely large files
                documents.push({
                    path: file.path,
                    content: content.slice(0, 4000), // Max 4k chars per file to save LLM context
                    metadata: { repository: ownerRepo, branch }  // Store normalized owner/repo (not full path) for consistent Qdrant filtering
                });

            } catch (err) {
                console.warn(`[RAG] Skipping file ${file.path}:`, err);
            }
        }

        console.log(`[RAG] Successfully downloaded ${documents.length} files. Forwarding to vectorizer...`);

        // 4. Send to Vector Database (Qdrant)
        // We use Xenova's MiniLM (local lightweight model) for embeddings
        const generateEmbeddings = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        const points = [];
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];

            // Generate dense vector embedding for the content
            const output = await generateEmbeddings(doc.content, { pooling: 'mean', normalize: true });
            const vector = Array.from(output.data);

            points.push({
                id: crypto.randomUUID(),
                vector,
                payload: {
                    source: "github",
                    title: doc.path,
                    text: doc.content,
                    repository: doc.metadata.repository,
                    branch: doc.metadata.branch
                }
            });
        }

        // Ensure collection exists and upsert to Qdrant
        const { ensureGithubCollection } = await import("@/lib/qdrant");
        await ensureGithubCollection();


        await qdrantClient.upsert(COLLECTIONS.GITHUB_REPOS, {
            wait: true,
            points: points
        });

        console.log(`[RAG] Ingestion for ${repository} Complete.`);

        return NextResponse.json({
            success: true,
            message: `Successfully indexed ${documents.length} files.`,
            processedFiles: documents.length
        });

    } catch (error: any) {
        console.error("[GitHub Ingestion Error]:", error);
        return NextResponse.json({ error: error.message || "Failed to ingest repository" }, { status: 500 });
    }
}
