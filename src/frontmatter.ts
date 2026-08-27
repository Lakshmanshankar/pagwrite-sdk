import { stringify } from "yaml";
import type { FileDocument, SiteSchema } from "./types.js";
import { upsertFrontmatter } from "./utils.js";

function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

function extractBody(content: string): string {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  if (!normalizedContent.startsWith("---\n")) {
    return normalizedContent;
  }
  const endIndex = normalizedContent.indexOf("\n---", 4);
  if (endIndex === -1) {
    return normalizedContent;
  }
  const bodyStart = normalizedContent.startsWith("\n", endIndex + 4) ? endIndex + 5 : endIndex + 4;
  return normalizedContent.slice(bodyStart);
}

export function buildMdxWithSchema(
  document: FileDocument,
  schema: SiteSchema | undefined,
  fallbackTitle: string,
  slug: string
): string {
  if (!schema) {
    // Fallback to standard metadata processing
    return upsertFrontmatter(document.mdxString ?? "", fallbackTitle, slug, document.id);
  }

  const frontmatter: Record<string, unknown> = {};
  const rawMetadata = document.metadata ?? {};

  // Process schema fields
  for (const field of schema.fields) {
    const camelKey = toCamelCase(field.name);
    
    if (camelKey in rawMetadata) {
      // Type coercion if necessary
      let value = rawMetadata[camelKey];
      // Basic coercion placeholder (can be expanded based on exact field types)
      if (field.type === "date" || field.type === "date_range") {
        if (value && typeof value === "string") {
            // Keep as string or parse date, YAML stringifier handles both nicely
        }
      } else if (field.type === "multi_select") {
        if (Array.isArray(value)) {
           // Array is fine, YAML stringifier handles it
        }
      }
      frontmatter[camelKey] = value;
    }
  }

  // Merge system-level metadata
  frontmatter.title = fallbackTitle;
  frontmatter.slug = slug;
  if (document.id) {
    frontmatter.id = document.id;
  }

  const yamlString = stringify(frontmatter);
  const mdxBody = extractBody(document.mdxString ?? "");
  
  return `---\n${yamlString.trim()}\n---\n\n${mdxBody}`;
}
