import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);

async function text(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

describe("Deploy to Cloudflare package contract", () => {
  it("uses the Trust Me Bro Center product identity", async () => {
    const manifest = JSON.parse(await text("package.json"));
    const wrangler = await text("wrangler.jsonc");
    const readme = await text("README.md");
    const workerServices = await text("src/worker-services.ts");
    const mcp = await text("src/mcp.ts");
    const admin = await text("public/admin/index.html");
    const adminClient = await text("public/admin/admin.js");
    const cursorMcp = await text("mcp.json.example");
    const demoDocument = await text("public/demo/security-overview.txt");

    expect(manifest.name).toBe("trust-me-bro-center");
    expect(wrangler).toContain('"name": "trust-me-bro-center"');
    expect(wrangler).toContain('"database_name": "trust-me-bro-center-db"');
    expect(wrangler).toContain('"preview_database_id": "trust-me-bro-center-local"');
    expect(wrangler).toContain('"bucket_name": "trust-me-bro-center-documents"');
    expect(readme).toMatch(/^# Trust Me Bro Center$/m);
    expect(workerServices).toContain("uploadedBy: 'trust-me-bro-center'");
    expect(mcp).toContain("name: 'trust-me-bro-center'");
    expect(admin).toContain("<title>Trust Me Bro Center Admin</title>");
    expect(admin).toContain("<strong>Trust Me Bro Center</strong>");
    expect(adminClient).toContain("'trust-me-bro-center-admin-token'");
    expect(cursorMcp).toContain('"trust-me-bro-center"');
    expect(demoDocument).toContain("Trust Me Bro Center project");
  });

  it("keeps deployment commands package-local and migrates through the D1 binding", async () => {
    const manifest = JSON.parse(await text("package.json"));

    expect(manifest.scripts["db:migrations:apply"]).toBe("wrangler d1 migrations apply DB --remote");
    expect(manifest.scripts.deploy).toBe("npm run db:migrations:apply && wrangler deploy");

    for (const section of [manifest.dependencies, manifest.devDependencies]) {
      for (const specifier of Object.values(section ?? {})) {
        expect(String(specifier)).not.toMatch(/^(?:workspace:|file:\.\.\/)/);
      }
    }
  });

  it("declares portable D1, R2, and secret metadata without enabling account-specific email", async () => {
    const manifest = JSON.parse(await text("package.json"));
    const wrangler = await text("wrangler.jsonc");
    const varsExample = await text(".dev.vars.example");

    expect(manifest.cloudflare.bindings.ADMIN_TOKEN.description).toBeTruthy();
    expect(manifest.cloudflare.bindings.DB.description).toBeTruthy();
    expect(manifest.cloudflare.bindings.DOCUMENTS.description).toBeTruthy();
    expect(wrangler).toContain('"binding": "DB"');
    expect(wrangler).toContain('"binding": "DOCUMENTS"');
    expect(wrangler).toContain('"database_id": "00000000-0000-0000-0000-000000000000"');
    expect(wrangler).not.toMatch(/^\s*"send_email"\s*:/m);

    const activeVariables = varsExample
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    expect(activeVariables).toEqual(["ADMIN_TOKEN=replace-with-a-long-random-admin-token"]);
  });

  it("ships the complete local migration set", async () => {
    const migrations = (await readdir(new URL("migrations/", root)))
      .filter((name: string) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    expect(migrations).toHaveLength(10);
    expect(migrations[0]).toBe("0001_initial.sql");
    expect(migrations.at(-1)).toBe("0010_trust_center_expansion.sql");
  });
});
