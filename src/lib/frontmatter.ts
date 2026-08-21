export interface ParsedMarkdownFile {
  attributes: Record<string, string>;
  body: string;
}

/**
 * Minimal `---\nkey: value\n---` frontmatter parser for the Markdown
 * importer. Deliberately not a full YAML parser — values are flat strings;
 * callers split comma-separated fields (e.g. tags) themselves.
 */
export function parseFrontmatter(raw: string): ParsedMarkdownFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { attributes: {}, body: raw };
  }

  const [, frontmatterBlock, body] = match;
  const attributes: Record<string, string> = {};
  for (const line of (frontmatterBlock ?? "").split(/\r?\n/)) {
    const lineMatch = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!lineMatch) continue;
    const [, key, value] = lineMatch;
    if (!key) continue;
    attributes[key] = (value ?? "").trim().replace(/^["']|["']$/g, "");
  }

  return { attributes, body: (body ?? "").trim() };
}
