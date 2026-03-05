export async function fetchGithubReleases(repo: string, accessToken: string) {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch GitHub releases");
    }

    return response.json();
}

/**
 * Recursively fetches the file tree of a GitHub repository branch.
 */
export async function fetchGithubTree(repo: string, branch: string, accessToken: string) {
    const response = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        throw new Error("Failed to fetch repository tree");
    }

    const data = await response.json();
    return data.tree as Array<{ path: string; type: "blob" | "tree"; url: string }>;
}

/**
 * Downloads a single file from the GitHub repository.
 */
export async function downloadGithubFile(repo: string, branch: string, path: string, accessToken: string) {
    const url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download file: ${path}`);
    }

    return response.text();
}

// Extensions we want to index for RAG (Smart Filtering to save costs)
const VALID_EXTENSIONS = new Set([
    ".js", ".jsx", ".ts", ".tsx", ".py", ".md", ".json", ".yaml", ".yml",
    ".java", ".cpp", ".c", ".h", ".go", ".rs", ".sql", ".sh", ".txt", ".env.example"
]);

// Directories we MUST ignore to save massive API context costs
const IGNORED_DIRS = [
    "node_modules", ".git", "dist", "build", "out", "coverage", ".next",
    "vendor", "public/assets", "target", "bin", "obj"
];

/**
 * Filters the raw GitHub tree to only include relevant source code files.
 */
export function filterRelevantFiles(tree: Array<{ path: string; type: "blob" | "tree" }>) {
    return tree.filter(node => {
        if (node.type !== "blob") return false; // Ignore directories

        // Check if file is in an ignored directory
        if (IGNORED_DIRS.some(dir => node.path.includes(`${dir}/`) || node.path.startsWith(`${dir}/`))) {
            return false;
        }

        // Check valid extension
        const extMatch = node.path.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0].toLowerCase() : "";
        return VALID_EXTENSIONS.has(ext) || node.path.toLowerCase() === "dockerfile";
    });
}
