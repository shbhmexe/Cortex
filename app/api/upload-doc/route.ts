import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { COLLECTIONS, qdrantClient, ensureInternalDocsCollection } from "@/lib/qdrant";
import { pipeline } from "@huggingface/transformers";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import crypto from "crypto";

export const maxDuration = 60; // Allows up to 60 minutes for processing large PDFs
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }


        const filename = file.name;
        const arrayBuffer = await file.arrayBuffer();
        let extractedText = "";

        // Determine parsing approach based on file type
        if (filename.endsWith(".pdf")) {
            const buffer = Buffer.from(arrayBuffer);
            const pdfParse = (await import("pdf-parse")).default;
            const data = await pdfParse(buffer);
            extractedText = data.text;
        } else if (filename.endsWith(".md") || filename.endsWith(".txt")) {
            const decoder = new TextDecoder("utf-8");
            extractedText = decoder.decode(arrayBuffer);
        } else {
            return NextResponse.json({ error: "Unsupported file type. Only PDF, MD, and TXT are supported." }, { status: 400 });
        }

        if (!extractedText.trim()) {
            return NextResponse.json({ error: "No readable text found in the file." }, { status: 400 });
        }

        // Chunk the text to fit context windows efficiently
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const chunks = await splitter.createDocuments([extractedText]);

        // Validate extraction limits to prevent excessive memory usage or API timeout locally
        if (chunks.length > 500) {
            return NextResponse.json({ error: "File too large. Maximum supported chunks is 500." }, { status: 413 });
        }

        console.log(`[Upload] Extracted ${chunks.length} chunks from ${filename}. Forwarding to vectorizer...`);

        // Generate Embeddings using same model as Github ingestion
        const generateEmbeddings = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        const points = [];
        for (let i = 0; i < chunks.length; i++) {
            const doc = chunks[i];

            // Generate dense vector embedding for the content chunk
            const output = await generateEmbeddings(doc.pageContent, { pooling: 'mean', normalize: true });
            const vector = Array.from(output.data);

            points.push({
                id: crypto.randomUUID(),
                vector,
                payload: {
                    userId,
                    filename,
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    text: doc.pageContent,
                }
            });
        }

        // Ensure collection exists and write vectors
        await ensureInternalDocsCollection();

        await qdrantClient.upsert(COLLECTIONS.INTERNAL_DOCS, {
            points,
        });

        console.log(`[Upload] Successfully stored ${points.length} vectors for ${filename} to Qdrant.`);

        return NextResponse.json({
            message: "File ingested successfully",
            chunks: chunks.length,
            filename
        });

    } catch (error: any) {
        console.error("[Upload] Error processing file:", error);
        return NextResponse.json({ error: error.message || "Failed to process " }, { status: 500 });
    }
}
