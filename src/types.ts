export interface RemoteMdxOptions {
  siteId: string;
  token?: string;
  tokenEnvVar?: string;
  outputDir?: string;
  clean?: boolean;
  verbose?: boolean;
}

export interface StaticTreeChild {
  id: string;
  title?: string;
  isFolder: boolean;
  children?: StaticTreeChild[];
  databaseType?: string;
  lang?: string;
}

export interface PageTreeFolderNode {
  id: string;
  type: "folder";
  title: string;
  path: string;
  databaseType?: string;
  lang?: string;
  children: PageTreeNode[];
}

export interface PageTreeFileNode {
  id: string;
  type: "file";
  title: string;
  path: string;
  storageFile: string;
}

export type PageTreeNode = PageTreeFolderNode | PageTreeFileNode;

export interface SitePages {
  siteId: string;
  rootFolderId: string;
  pages: PageTreeNode[];
  tags: Record<string, unknown>;
}

export interface FileDocument {
  id: string;
  mdxString?: string;
  [key: string]: unknown;
}

export interface StagedSiteContentFile {
  id: string;
  relPath: string;
  absolutePath: string;
}

export interface StagedSiteContent {
  sitePages: SitePages;
  files: StagedSiteContentFile[];
}

export interface RemoteMdxLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
