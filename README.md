# Vibescript for VS Code

Syntax highlighting and language server support for
[Vibescript](https://github.com/xipkit/vibescript) in one extension.

## Features

- Syntax highlighting for `.vibe` files, including strings with interpolation,
  regex literals, symbols, enums, typed locals and signatures, generics,
  unions, optionals, tuples, record shapes, type aliases, and brace blocks
- Diagnostics, hover documentation, completions, signature help,
  go-to-definition, document symbols, and formatting through `vibes lsp`
- Comment toggling, bracket matching, and indentation rules

## Requirements

Supports the Rust implementation of Vibescript v0.80.0. Install its CLI and
language server with:

```sh
cargo install --git https://github.com/xipkit/vibescript --tag v0.80.0 vibes
```

Add Cargo's bin directory (`~/.cargo/bin` by default) to your editor's `PATH`.
The server command remains `vibes lsp`. Replace any path to the retired Go binary.

Highlighting works with or without the binary; only the language server
features need it.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `vibescript.server.path` | `""` | Absolute path to `vibes`. Empty means look it up on `PATH`. |
| `vibescript.server.args` | `["lsp"]` | Arguments used to start the language server. |
| `vibescript.trace.server` | `"off"` | Log the traffic between VS Code and the server. |

Run **Vibescript: Restart Language Server** from the command palette after
changing the toolchain on disk.

## Development

```sh
npm install
npm test          # compile, grammar assertions, and unit tests
code --extensionDevelopmentPath="$PWD"
```

### Grammar tests

`tests/grammar/` holds [vscode-tmgrammar-test](https://github.com/PanAeon/vscode-tmgrammar-test)
assertions. `syntax_test_vibescript.vibe` is ported from the Sublime Text
package's suite so both grammars stay in step;
`syntax_test_textmate_edges.vibe` covers cases specific to this port.

To inspect what the grammar actually produces for a file:

```sh
npx vscode-tmgrammar-snap -u path/to/file.vibe
```

## Known limitations

Regex literals are detected with a heuristic (a `/` that does not follow a value
and is not followed by a space or `=`), so half-spaced division like `a /b` may
highlight as a regex. `a / b` and `a/b` highlight correctly.

Unlike the Sublime Text syntax, code inside `#{...}` keeps the surrounding
string scope, because TextMate grammars cannot clear an enclosing scope. It is
tagged `meta.embedded.line.vibescript` instead, which the default themes render
as ordinary code.

## Related

- [vibescript](https://github.com/xipkit/vibescript) - the language and toolchain
- [sublime-vibescript](https://github.com/mgomes/sublime-vibescript) and
  [LSP-vibescript](https://github.com/mgomes/LSP-vibescript) - Sublime Text support
- [zed-vibescript](https://github.com/mgomes/zed-vibescript) - Zed support
- [tree-sitter-vibescript](https://github.com/mgomes/tree-sitter-vibescript) - tree-sitter grammar

The `# vibe: 0.80` first-line marker still identifies extensionless scripts.
It is an ordinary comment to the Rust compiler, not a version constraint.
Removed syntax (`unless`, `until`, `do ... end`, percent literals and symbol
hash keys) is no longer highlighted as supported language syntax. Use `vibes fix`
to migrate old programs.

Bare zero-argument function calls and local references share the same spelling;
lexical highlighting cannot distinguish them. Dotted calls remain highlighted.
