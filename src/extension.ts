import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from "vscode-languageclient/node";

import { BINARY_NAME, resolveServerBinary } from "./server";

const LANGUAGE_ID = "vibescript";
const CONFIG_SECTION = "vibescript";
const INSTALL_URL = "https://github.com/mgomes/vibescript#installation";

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    outputChannel = vscode.window.createOutputChannel("Vibescript");
    context.subscriptions.push(outputChannel);

    context.subscriptions.push(
        vscode.commands.registerCommand("vibescript.restartServer", async () => {
            await stopClient();
            await startClient();
        }),
    );

    // The server reads no workspace configuration, so a settings change only
    // matters when it changes how the process itself is launched.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration("vibescript.server")) {
                await stopClient();
                await startClient();
            }
        }),
    );

    await startClient();
}

export async function deactivate(): Promise<void> {
    await stopClient();
}

async function startClient(): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const configuredPath = config.get<string>("server.path", "");
    const command = resolveServerBinary(configuredPath);

    if (!command) {
        await reportMissingBinary(configuredPath);
        return;
    }

    const args = config.get<string[]>("server.args", ["lsp"]);
    // `transport` is deliberately omitted. TransportKind.stdio appends a
    // `--stdio` flag to argv, and `vibes lsp` rejects unknown flags; leaving it
    // undefined spawns the same stdio pipes without the extra argument.
    const serverOptions: ServerOptions = { command, args };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", language: LANGUAGE_ID }],
        outputChannel,
    };

    client = new LanguageClient(
        LANGUAGE_ID,
        "Vibescript Language Server",
        serverOptions,
        clientOptions,
    );

    try {
        await client.start();
    } catch (error) {
        client = undefined;
        const message = error instanceof Error ? error.message : String(error);
        outputChannel?.appendLine(`Failed to start ${command}: ${message}`);
        void vscode.window.showErrorMessage(
            `Vibescript: failed to start the language server (${message}). See the Vibescript output channel.`,
        );
    }
}

async function stopClient(): Promise<void> {
    const current = client;
    client = undefined;
    if (current) {
        await current.stop();
    }
}

async function reportMissingBinary(configuredPath: string): Promise<void> {
    const detail = configuredPath.trim()
        ? `\`${configuredPath}\` is not an executable file.`
        : `\`${BINARY_NAME}\` was not found on your PATH.`;
    outputChannel?.appendLine(`Vibescript: ${detail} Language server not started.`);

    const install = "Install instructions";
    const setPath = "Set path...";
    const choice = await vscode.window.showErrorMessage(
        `Vibescript: ${detail} Syntax highlighting still works, but diagnostics and completions are disabled.`,
        install,
        setPath,
    );

    if (choice === install) {
        await vscode.env.openExternal(vscode.Uri.parse(INSTALL_URL));
    } else if (choice === setPath) {
        await vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "vibescript.server.path",
        );
    }
}
