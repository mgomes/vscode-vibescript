// Drives `vibes lsp` over stdio with the exact argv the extension uses, so a
// change to how the client launches the server (an injected transport flag, a
// bad default in server.args) fails here instead of silently disabling every
// language feature at runtime. Skipped when the toolchain is not installed.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

const { resolveServerBinary } = require("../out/server.js");
const packageJson = require("../package.json");

const SERVER_ARGS =
    packageJson.contributes.configuration.properties["vibescript.server.args"].default;

function frame(payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    return Buffer.concat([
        Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "ascii"),
        body,
    ]);
}

function parseFrames(buffer) {
    const messages = [];
    let offset = 0;
    while (true) {
        const headerEnd = buffer.indexOf("\r\n\r\n", offset);
        if (headerEnd < 0) {
            break;
        }
        const header = buffer.toString("ascii", offset, headerEnd);
        const match = /content-length:\s*(\d+)/i.exec(header);
        if (!match) {
            break;
        }
        const start = headerEnd + 4;
        const end = start + Number(match[1]);
        if (end > buffer.length) {
            break;
        }
        messages.push(JSON.parse(buffer.toString("utf8", start, end)));
        offset = end;
    }
    return messages;
}

function runHandshake(command, args, source) {
    return new Promise((resolve, reject) => {
        const server = spawn(command, args);
        const stdout = [];
        const stderr = [];
        server.stdout.on("data", (chunk) => stdout.push(chunk));
        server.stderr.on("data", (chunk) => stderr.push(chunk));
        server.on("error", reject);
        server.on("close", (code) =>
            resolve({
                code,
                messages: parseFrames(Buffer.concat(stdout)),
                stderr: Buffer.concat(stderr).toString("utf8"),
            }),
        );

        server.stdin.write(frame({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: { processId: process.pid, rootUri: null, capabilities: {} },
        }));
        server.stdin.write(frame({ jsonrpc: "2.0", method: "initialized", params: {} }));
        server.stdin.write(frame({
            jsonrpc: "2.0",
            method: "textDocument/didOpen",
            params: {
                textDocument: {
                    uri: "file:///handshake.vibe",
                    languageId: "vibescript",
                    version: 1,
                    text: source,
                },
            },
        }));
        server.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "shutdown", params: null }));
        server.stdin.write(frame({ jsonrpc: "2.0", method: "exit" }));
        server.stdin.end();
    });
}

const binary = resolveServerBinary("");

test(
    "the extension's argv starts the server and yields diagnostics",
    { skip: binary ? false : "vibes is not on PATH" },
    async () => {
        const result = await runHandshake(binary, SERVER_ARGS, 'puts "unterminated\n');

        assert.equal(result.code, 0, `server exited ${result.code}: ${result.stderr}`);
        assert.equal(result.stderr, "", `server wrote to stderr: ${result.stderr}`);

        const initialize = result.messages.find((m) => m.id === 1);
        assert.ok(initialize, "no initialize response");
        const capabilities = initialize.result.capabilities;
        for (const capability of [
            "hoverProvider",
            "definitionProvider",
            "documentSymbolProvider",
            "documentFormattingProvider",
            "completionProvider",
            "signatureHelpProvider",
        ]) {
            assert.ok(capabilities[capability], `server did not advertise ${capability}`);
        }

        const published = result.messages.filter(
            (m) => m.method === "textDocument/publishDiagnostics",
        );
        assert.ok(published.length > 0, "server published no diagnostics");
        assert.ok(
            published.some((m) => m.params.diagnostics.length > 0),
            "server reported no diagnostic for a file with a syntax error",
        );
    },
);

test(
    "the Rust server checks static types and canonical operators",
    { skip: binary ? false : "vibes is not on PATH" },
    async () => {
        const valid = await runHandshake(binary, SERVER_ARGS,
            '# vibe: 0.80\ntype Pair = [int, string]\nvalue: int = 7 // 2\nvalue //= 2\n');
        assert.equal(valid.code, 0);
        const diagnostics = valid.messages.filter((m) => m.method === "textDocument/publishDiagnostics");
        assert.ok(diagnostics.length > 0);
        assert.ok(diagnostics.every((m) => m.params.diagnostics.length === 0));

        const invalid = await runHandshake(binary, SERVER_ARGS, 'value: int = "wrong"\n');
        assert.equal(invalid.code, 0);
        assert.ok(invalid.messages.some((m) =>
            m.method === "textDocument/publishDiagnostics" &&
            m.params.diagnostics.some((d) => d.code === "V0101")));
    },
);
