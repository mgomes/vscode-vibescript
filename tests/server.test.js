const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test, beforeEach, afterEach } = require("node:test");

const { resolveServerBinary, BINARY_NAME } = require("../out/server.js");

let tmpDir;
let originalPath;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibescript-server-test-"));
    originalPath = process.env.PATH;
});

afterEach(() => {
    process.env.PATH = originalPath;
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeExecutable(dir, name) {
    const target = path.join(dir, name);
    fs.writeFileSync(target, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    return target;
}

test("finds the binary on PATH when no path is configured", () => {
    const expected = writeExecutable(tmpDir, BINARY_NAME);
    process.env.PATH = tmpDir;
    assert.equal(resolveServerBinary(""), expected);
});

test("skips PATH entries that do not hold the binary", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibescript-empty-"));
    const expected = writeExecutable(tmpDir, BINARY_NAME);
    process.env.PATH = [emptyDir, tmpDir].join(path.delimiter);
    try {
        assert.equal(resolveServerBinary(""), expected);
    } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
    }
});

test("returns undefined when the binary is absent from PATH", () => {
    process.env.PATH = tmpDir;
    assert.equal(resolveServerBinary(""), undefined);
});

test("prefers an explicitly configured path over PATH", () => {
    writeExecutable(tmpDir, BINARY_NAME);
    process.env.PATH = tmpDir;
    const elsewhere = writeExecutable(tmpDir, "vibes-custom");
    assert.equal(resolveServerBinary(elsewhere), elsewhere);
});

test("trims whitespace around a configured path", () => {
    const expected = writeExecutable(tmpDir, "vibes-custom");
    assert.equal(resolveServerBinary(`  ${expected}  `), expected);
});

test("rejects a configured path that is not executable", () => {
    const target = path.join(tmpDir, "not-executable");
    fs.writeFileSync(target, "plain file\n", { mode: 0o644 });
    assert.equal(resolveServerBinary(target), undefined);
});

test("rejects a configured path that is a directory", () => {
    assert.equal(resolveServerBinary(tmpDir), undefined);
});

test("does not fall back to PATH when a configured path is wrong", () => {
    writeExecutable(tmpDir, BINARY_NAME);
    process.env.PATH = tmpDir;
    assert.equal(resolveServerBinary(path.join(tmpDir, "missing")), undefined);
});
