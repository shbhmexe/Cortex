/**
 * PR Security Analysis Tool
 * Fetches a GitHub Pull Request's metadata + file diffs, then returns
 * a structured context string for the LLM to perform a security review.
 */

const PR_URL_REGEX = /github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/(\d+)/;

export interface PRMatch {
    owner: string;
    repo: string;
    prNumber: string;
    fullUrl: string;
}

/** Detect a GitHub PR URL in any message string. Returns null if not found. */
export function detectPRUrl(message: string): PRMatch | null {
    const match = message.match(PR_URL_REGEX);
    if (!match) return null;
    return {
        owner: match[1],
        repo: match[2],
        prNumber: match[3],
        fullUrl: match[0],
    };
}

/** Fetch PR metadata + file diffs from GitHub API.
 *  accessToken is optional — public repos work without it.
 */
export async function fetchPRContext(
    owner: string,
    repo: string,
    prNumber: string,
    accessToken?: string
): Promise<string> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CortEx-AI",
    };
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

    // 1. Fetch PR metadata
    const metaRes = await fetch(base, { headers });
    if (!metaRes.ok) {
        const err = await metaRes.text();
        throw new Error(`GitHub API error fetching PR metadata: ${metaRes.status} — ${err}`);
    }
    const meta = await metaRes.json();

    // 2. Fetch changed files + patches
    const filesRes = await fetch(`${base}/files?per_page=30`, { headers });
    if (!filesRes.ok) {
        throw new Error(`GitHub API error fetching PR files: ${filesRes.status}`);
    }
    const files: any[] = await filesRes.json();

    // 3. Format for LLM — keep patches concise (max ~6k chars total)
    let totalPatchChars = 0;
    const MAX_PATCH_CHARS = 6000;
    const fileSummaries = files.map((f: any) => {
        const status = f.status; // added | modified | removed | renamed
        const patch = f.patch ?? "(binary or too large to show)";
        const patchSlice = patch.slice(0, 800); // max 800 chars per file
        totalPatchChars += patchSlice.length;

        return `### ${f.filename} [${status}, +${f.additions}/-${f.deletions}]
\`\`\`diff
${patchSlice}${patch.length > 800 ? "\n... (truncated)" : ""}
\`\`\``;
    }).join("\n\n");

    return `## GitHub PR #${prNumber}: ${meta.title}
**Repo:** ${owner}/${repo}  
**Author:** ${meta.user?.login ?? "unknown"}  
**Base → Head:** \`${meta.base?.ref}\` ← \`${meta.head?.ref}\`  
**Status:** ${meta.state} | Mergeable: ${meta.mergeable ?? "unknown"}  
**Description:**
${meta.body?.slice(0, 500) ?? "(no description)"}

---
## Changed Files (${files.length} total)

${fileSummaries}`;
}
