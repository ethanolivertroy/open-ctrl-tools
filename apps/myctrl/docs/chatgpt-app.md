# myctrl.tools ChatGPT App

The ChatGPT App entrypoint is `/mcp`. It exposes a read-only MCP server for
ChatGPT Apps and uses the static `/api/chatgpt-app/catalog.json` asset as its
catalog source, so the Cloudflare Worker does not bundle the full framework
dataset.

## Tools

- `search`: finds myctrl.tools controls, frameworks, guides, crosswalks, and
  pages using the standard ChatGPT search result shape.
- `fetch`: returns full text and metadata for a `search` result, URL, or
  `frameworkId:controlId` pair using the standard ChatGPT fetch shape.
- `build_gap_review`: builds an evidence-first gap review workflow and renders
  the MCP App widget at `ui://myctrl/gap-review.html`.

## Local Test

```bash
npm run dev
npx @modelcontextprotocol/inspector@latest --server-url http://localhost:4321/mcp --transport http
```

For ChatGPT, expose the local server with an HTTPS tunnel and create a
developer-mode connector that points at the public URL with `/mcp`.
