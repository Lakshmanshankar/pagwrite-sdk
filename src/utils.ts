import path from "node:path";
import type { PageMapNode, PageTreeFileNode, PageTreeNode } from "./types.js";

export function generatePageMap(nodes: PageTreeNode[]): PageMapNode[] {
  return nodes.map((node) => {
    const slug = toSlug(safeRelativePath(node.path));
    if (node.type === "folder") {
      return {
        id: node.id,
        title: node.title,
        slug,
        children: generatePageMap(node.children),
      };
    }
    return {
      id: node.id,
      title: node.title,
      slug,
    };
  });
}

export function flattenFileNodes(nodes: PageTreeNode[]): PageTreeFileNode[] {
  const files: PageTreeFileNode[] = [];

  for (const node of nodes) {
    if (node.type === "file") {
      files.push(node);
    } else {
      files.push(...flattenFileNodes(node.children));
    }
  }

  return files;
}

export function safeRelativePath(value: string): string {
  const normalizedSlashes = value.replace(/\\/g, "/").trim();

  if (!normalizedSlashes || normalizedSlashes.includes("\0")) {
    throw new Error("Invalid empty content path");
  }

  if (path.posix.isAbsolute(normalizedSlashes)) {
    throw new Error(`Unsafe absolute content path: ${value}`);
  }

  const normalized = path.posix.normalize(normalizedSlashes);

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Unsafe relative content path: ${value}`);
  }

  return normalized;
}

export function toSegment(title: string, fallback: string): string {
  const slug = slugify(title);
  return slug || slugify(fallback) || fallback;
}

export function toSlug(relativePath: string): string {
  return safeRelativePath(relativePath)
    .split("/")
    .map((segment) => toSegment(segment, segment))
    .join("/");
}

export interface FrontmatterOptions {
  description?: string;
  status?: string;
  metaKeywords?: string[];
  datePublished?: string;
}

export function upsertFrontmatter(
  content: string,
  title: string,
  slug: string,
  id?: string,
  options?: FrontmatterOptions
): string {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  
  const lines = [
    `title: ${quoteYamlString(title)}`,
    `slug: ${quoteYamlString(slug)}`,
  ];
  if (id) lines.push(`id: ${quoteYamlString(id)}`);
  if (options?.description) lines.push(`description: ${quoteYamlString(options.description)}`);
  if (options?.status) lines.push(`status: ${quoteYamlString(options.status)}`);
  if (options?.metaKeywords && options.metaKeywords.length > 0) {
    lines.push(`metaKeywords:`);
    for (const kw of options.metaKeywords) {
      lines.push(`  - ${quoteYamlString(kw)}`);
    }
  }
  if (options?.datePublished) lines.push(`datePublished: ${quoteYamlString(options.datePublished)}`);

  if (!normalizedContent.startsWith("---\n")) {
    return `---\n${lines.join("\n")}\n---\n\n${normalizedContent}`;
  }

  const endIndex = normalizedContent.indexOf("\n---", 4);
  if (endIndex === -1) {
    return `---\n${lines.join("\n")}\n---\n\n${normalizedContent}`;
  }

  const existingFrontmatter = normalizedContent.slice(4, endIndex);
  const bodyStart = normalizedContent.startsWith("\n", endIndex + 4) ? endIndex + 5 : endIndex + 4;
  const body = normalizedContent.slice(bodyStart);
  
  const existingLines = existingFrontmatter.split("\n");
  const remainingLines: string[] = [];
  
  const keysToRemove = ["title", "slug", "id", "description", "status", "metaKeywords", "datePublished"];
  let skipMode = false;

  for (const line of existingLines) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*:/);
    if (match) {
      const key = match[1];
      if (keysToRemove.includes(key)) {
        skipMode = true;
        continue;
      } else {
        skipMode = false;
      }
    } else if (skipMode) {
      const isIndented = line.trim() === "" || line.startsWith(" ") || line.startsWith("\t") || line.startsWith("-");
      if (isIndented) {
        continue;
      } else {
        skipMode = false;
      }
    }

    if (!skipMode) {
      remainingLines.push(line);
    }
  }

  const cleanedRemainingLines = remainingLines.filter((line, index, arr) => line.trim() !== "" || index < arr.length - 1);
  const nextFrontmatter = [...lines, ...cleanedRemainingLines].join("\n").trim();

  return `---\n${nextFrontmatter}\n---${body.startsWith("\n") ? "" : "\n"}${body}`;
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}
