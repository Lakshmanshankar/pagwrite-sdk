import path from "node:path";
import { ensureDir, writeTextFile } from "./fs.js";
import type {
  FileDocument,
  PageTreeNode,
  RemoteMdxLogger,
  SitePages,
  StagedSiteContent,
  StaticTreeChild,
} from "./types.js";
import {
  flattenFileNodes,
  generatePageMap,
  safeRelativePath,
  toSegment,
  toSlug,
  upsertFrontmatter,
} from "./utils.js";

export const STATIC_FILE_TREE_URL = "https://getstaticfiletree-hhjkelprqq-uc.a.run.app";
export const PAGINATED_FILE_DOCUMENTS_URL =
  "https://us-central1-sanity-freeform.cloudfunctions.net/getPaginatedFileDocuments";
export const DEFAULT_PAGE_SIZE = 100;

export interface FetchSiteContentOptions {
  fetchImpl?: typeof fetch;
  logger?: Pick<RemoteMdxLogger, "warn">;
  pageSize?: number;
  timeoutMs?: number;
}

async function fetchJson<T>(
  url: string,
  token: string,
  body: Record<string, unknown>,
  errorPrefix: string,
  options: FetchSiteContentOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${errorPrefix}: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${errorPrefix}: request timed out after ${options.timeoutMs ?? 30_000}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchStaticFileTree(
  siteId: string,
  token: string,
  options: FetchSiteContentOptions = {},
): Promise<SitePages> {
  const responseData = await fetchJson<{ root?: StaticTreeChild }>(
    STATIC_FILE_TREE_URL,
    token,
    { siteId },
    "Failed to fetch static file tree",
    options,
  );

  const root = responseData.root;
  if (!root || !root.isFolder) {
    throw new Error("Invalid file tree response: root folder is missing");
  }

  const walkFolder = (children: StaticTreeChild[], parentPath: string): PageTreeNode[] =>
    children.map((child) => {
      const title = typeof child.title === "string" && child.title.trim().length > 0 ? child.title : child.id;
      const childPath = parentPath ? `${parentPath}/${toSegment(title, child.id)}` : toSegment(title, child.id);

      if (child.isFolder) {
        return {
          id: child.id,
          type: "folder" as const,
          title,
          path: childPath,
          databaseType: child.databaseType,
          lang: child.lang,
          children: walkFolder(child.children ?? [], childPath),
        };
      }

      return {
        id: child.id,
        type: "file" as const,
        title,
        path: childPath,
        storageFile: "",
      };
    });

  return {
    siteId,
    rootFolderId: root.id,
    pages: walkFolder(root.children ?? [], ""),
    tags: {},
  };
}

export async function fetchAllFileDocuments(
  siteId: string,
  token: string,
  options: FetchSiteContentOptions = {},
): Promise<Map<string, FileDocument>> {
  const documents = new Map<string, FileDocument>();
  let pageToken: string | null = null;

  do {
    const responseData: { documents?: FileDocument[]; nextPageToken?: string | null } = await fetchJson<{
      documents?: FileDocument[];
      nextPageToken?: string | null;
    }>(
      PAGINATED_FILE_DOCUMENTS_URL,
      token,
      {
        siteId,
        pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
        pageToken,
      },
      "Failed to fetch paginated file documents",
      options,
    );

    for (const document of responseData.documents ?? []) {
      documents.set(document.id, document);
    }

    pageToken = responseData.nextPageToken ?? null;
  } while (pageToken);

  return documents;
}

export async function stageSiteContent(
  siteId: string,
  token: string,
  contentDir: string,
  options: FetchSiteContentOptions = {},
): Promise<StagedSiteContent> {
  const [sitePages, documents] = await Promise.all([
    fetchStaticFileTree(siteId, token, options),
    fetchAllFileDocuments(siteId, token, options),
  ]);
  const fileNodes = flattenFileNodes(sitePages.pages);

  await ensureDir(contentDir);

  const files: StagedSiteContent["files"] = [];
  for (const fileNode of fileNodes) {
    const normalizedPath = safeRelativePath(fileNode.path);
    const relPath = `${normalizedPath}.mdx`;
    const absolutePath = path.join(contentDir, relPath);
    const document = documents.get(fileNode.id);

    if (!document) {
      options.logger?.warn(`Document not found for file node: ${fileNode.id} (${fileNode.title})`);
    }

    const slug = toSlug(normalizedPath);
    const contentWithFrontmatter = upsertFrontmatter(document?.mdxString ?? "", fileNode.title, slug, fileNode.id);

    await ensureDir(path.dirname(absolutePath));
    await writeTextFile(absolutePath, contentWithFrontmatter);

    files.push({
      id: fileNode.id,
      relPath,
      absolutePath,
    });
  }

  const pagemap = generatePageMap(sitePages.pages);
  const pagemapPath = path.join(contentDir, "pagemap.json");
  await writeTextFile(pagemapPath, JSON.stringify(pagemap, null, 2));

  return {
    sitePages,
    files,
  };
}
