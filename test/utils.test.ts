import { describe, expect, it } from "vitest";
import { flattenFileNodes, generatePageMap, safeRelativePath, toSegment, toSlug, upsertFrontmatter } from "../src/utils.js";

describe("content utils", () => {
  it("generates page map", () => {
    expect(
      generatePageMap([
        {
          id: "folder-1",
          type: "folder",
          title: "Docs",
          path: "docs",
          children: [
            {
              id: "file-1",
              type: "file",
              title: "Getting Started",
              path: "docs/getting-started",
              storageFile: "",
            },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "folder-1",
        title: "Docs",
        slug: "docs",
        children: [
          {
            id: "file-1",
            title: "Getting Started",
            slug: "docs/getting-started",
          },
        ],
      },
    ]);
  });

  it("flattens file nodes", () => {
    expect(
      flattenFileNodes([
        {
          id: "folder",
          type: "folder",
          title: "Folder",
          path: "folder",
          children: [{ id: "file", type: "file", title: "File", path: "folder/file", storageFile: "" }],
        },
      ]),
    ).toEqual([{ id: "file", type: "file", title: "File", path: "folder/file", storageFile: "" }]);
  });

  it("normalizes segments and slugs", () => {
    expect(toSegment("Getting Started!", "fallback")).toBe("getting-started");
    expect(toSlug("Docs/Getting Started")).toBe("docs/getting-started");
  });

  it("rejects unsafe relative paths", () => {
    expect(() => safeRelativePath("../secret")).toThrow("Unsafe relative content path");
    expect(() => safeRelativePath("/secret")).toThrow("Unsafe absolute content path");
    expect(() => safeRelativePath("")).toThrow("Invalid empty content path");
  });

  it("inserts frontmatter", () => {
    expect(upsertFrontmatter("# Body", "Hello", "hello")).toBe(
      '---\ntitle: "Hello"\nslug: "hello"\n---\n\n# Body',
    );
  });

  it("updates existing frontmatter", () => {
    expect(upsertFrontmatter('---\ntitle: "Old"\ndraft: true\n---\n# Body', "New", "new")).toBe(
      '---\ntitle: "New"\nslug: "new"\ndraft: true\n---\n# Body',
    );
  });
});
