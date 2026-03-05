import { NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';

export async function POST(req: Request) {
    try {
        const { code, language } = await req.json();

        if (!code) {
            return NextResponse.json({ error: "No code provided" }, { status: 400 });
        }

        const apiKey = process.env.E2B_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "E2B API key not configured. Please add E2B_API_KEY to your environment variables."
            }, { status: 500 });
        }

        // Initialize the E2B Code Interpreter Sandbox
        const sandbox = await Sandbox.create({ apiKey });

        if (!('files' in sandbox)) {
            // Fallback if sandbox initialization failed
            return NextResponse.json({ error: `Sandbox initialization failed.` }, { status: 500 });
        }

        let result: any;
        if (language === 'python' || language === 'py') {
            result = await sandbox.runCode(code);
        } else if (language === 'javascript' || language === 'js' || language === 'typescript' || language === 'ts') {
            // E2B natively supports python via .runCode, but for JS we can run a shell command
            // using node. Let's write the code to a file and run it.
            await sandbox.files.write('/home/user/script.js', code);
            result = await sandbox.commands.run("node /home/user/script.js");
        } else if (language === 'cpp' || language === 'c') {
            await sandbox.files.write('/home/user/main.cpp', code);
            const build = await sandbox.commands.run("g++ /home/user/main.cpp -o /home/user/main");
            if (build.error || build.stderr) {
                result = build; // Compilation failed
            } else {
                result = await sandbox.commands.run("/home/user/main");
            }
        } else if (language === 'java') {
            await sandbox.files.write('/home/user/Main.java', code);
            const build = await sandbox.commands.run("javac /home/user/Main.java");
            if (build.error || build.stderr) {
                result = build; // Compilation failed
            } else {
                result = await sandbox.commands.run("java -cp /home/user Main");
            }
        } else {
            // For unsupported languages, return an error or try a generic bash execution
            await sandbox.kill();
            return NextResponse.json({ error: `Execution for language '${language}' is not officially supported in this setup yet.` }, { status: 400 });
        }

        const stdout = result?.logs?.stdout || result?.stdout || [];
        const stderr = result?.logs?.stderr || result?.stderr || [];

        let formattedStdout = Array.isArray(stdout) ? stdout.map((l: any) => typeof l === 'string' ? l : l.line || l).join('\n') : stdout;
        let formattedStderr = Array.isArray(stderr) ? stderr.map((l: any) => typeof l === 'string' ? l : l.line || l).join('\n') : stderr;

        if (result?.error && !formattedStderr) {
            formattedStderr = `${result.error.name || 'Error'}: ${result.error.value || ''}\n${result.error.traceback || ''}`;
        }

        // Close sandbox to free resources
        await sandbox.kill();

        return NextResponse.json({
            success: true,
            stdout: formattedStdout || "",
            stderr: formattedStderr || "",
            results: 'results' in result ? result.results : [] // Any charts, images, dataframes
        });

    } catch (error: any) {
        console.error("E2B Execution Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Failed to execute code"
        }, { status: 500 });
    }
}
