import * as fs from "fs";
import * as path from "path";

/** Name of the toolchain binary that hosts the language server. */
export const BINARY_NAME = "vibes";

/**
 * Resolves the `vibes` executable, preferring an explicit path over a PATH
 * lookup. Returns undefined when no executable candidate exists.
 */
export function resolveServerBinary(configuredPath: string): string | undefined {
    const explicit = configuredPath.trim();
    if (explicit) {
        return isExecutable(explicit) ? explicit : undefined;
    }
    return findOnPath(BINARY_NAME);
}

function findOnPath(name: string): string | undefined {
    const searchPath = process.env.PATH;
    if (!searchPath) {
        return undefined;
    }
    for (const dir of searchPath.split(path.delimiter)) {
        if (!dir) {
            continue;
        }
        for (const candidate of withExecutableExtensions(path.join(dir, name))) {
            if (isExecutable(candidate)) {
                return candidate;
            }
        }
    }
    return undefined;
}

// Windows records the executable suffixes it will run in PATHEXT; every other
// platform relies on the mode bits alone.
function withExecutableExtensions(base: string): string[] {
    if (process.platform !== "win32") {
        return [base];
    }
    const pathExt = process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
    return pathExt.split(";").filter(Boolean).map((ext) => base + ext);
}

function isExecutable(candidate: string): boolean {
    try {
        const stats = fs.statSync(candidate);
        if (!stats.isFile()) {
            return false;
        }
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}
