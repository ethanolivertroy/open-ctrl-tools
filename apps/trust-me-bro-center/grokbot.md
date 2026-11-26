# Give this to Grok Bot

Point a Grok Bot or Cursor agent at this file when connecting the trust center. The bot manages published security content through MCP. It does not replace the admin UI, and it does not invent commercial claims.

Trust Me Bro Center is a public trust center on Cloudflare Workers. Incoming agents use `/mcp` with the shared admin Bearer token. The same endpoint works for [Cursor](https://cursor.com) and [Grok Bot](https://grokbot.x.ai). The inbox template at https://github.com/ethanolivertroy/grokbot-cloudflare-inbox is a separate mailbox product; this Worker is the Trust Me Bro Center Plugin. Outbound trust-center mail uses the same Cloudflare Email Service `send_email` binding. It does not call a third-party mail API.

## What the bot can do

After the connector is attached, the bot can:

- Read the public snapshot and the full admin workspace
- Edit the company profile, logo, FAQ, documents, assurance, subprocessors, and updates
- Move records through draft, review, published, and archived
- Approve or deny access requests and revoke grants
- Reset demonstration Northstar Labs content when the operator confirms
- If content still lives in another trust center or compliance platform, read that system and write records here. Do not paste a vendor dump into this Worker.

The bot does not need to click admin buttons. Prefer tools over the browser UI.

## Connect Grok Bot

Grok Bot shows connectors as Plugins. Installed connectors are account-wide, so every Bot on the operator's account can invoke this trust center. Confirm that scope and check team MCP policy before creating or pasting the admin token.

1. Confirm the operator wants this trust-center connector available to every Bot on their account.
2. Check team MCP policy. Teams can disable MCP, block member-added servers, or require a server allowlist.
3. Open **Settings > Plugins** and start the custom MCP flow. If the UI redirects to the connector page, choose **New Connector > Custom**.
4. Enter `https://<WORKER_HOST>/mcp` as the remote MCP URL.
5. Prepare a protected or masked static header named `Authorization`. Do not reveal the admin token until this field is ready.
6. Pause and ask the human to take over. The human pastes `Bearer <ADMIN_TOKEN>` into the protected header, saves the connector, and closes any shown-once secret display.
7. During takeover, Grok Bot must not inspect, copy, transcribe, screenshot, or store the token. Resume only after the human confirms the field is masked and saved.
8. If the connector cannot store the header as a protected secret, stop. Never put the token in chat, a screenshot, a config file, shell history, or Grok Bot's shared filesystem.
9. Wait for tool discovery, attach the Plugin with `@`, and call `trust_center_guide`.

Pass conditions:

- Connector status is connected
- Trust-center tools are listed
- `get_public_snapshot` returns the current published site
- No Cloudflare Access login HTML appears during tool discovery

If the Plugin says **Disabled by team admin**, stop and ask the appropriate administrator to approve or allowlist `https://<WORKER_HOST>/mcp`.

## Connect Cursor

Cursor uses the same URL and header.

```json
{
  "mcpServers": {
    "trust-me-bro-center": {
      "url": "https://<WORKER_HOST>/mcp",
      "headers": {
        "Authorization": "Bearer <ADMIN_TOKEN>"
      }
    }
  }
}
```

For local wrangler, use `http://127.0.0.1:8787/mcp` and the token from `.dev.vars`. Do not commit that file.

## Access

Keep `/admin` and the public site behind Cloudflare Access when you want a human login. Leave `/mcp` and `/mcp/*` reachable by the Worker. The Worker authenticates those paths with the admin Bearer token and fails closed without it.

If a hostname-wide Access application covers every path, create separate Bypass applications only for:

- `https://<WORKER_HOST>/mcp`
- `https://<WORKER_HOST>/mcp/*`

Do not add Bypass to the UI application.

## Connector instructions

Add these non-secret instructions to the connector or setup context:

```text
This is the operator's public trust center.

Call trust_center_guide first. Use get_public_snapshot to see what visitors see, and get_admin_state with a sections filter when you only need one list.

New records start as drafts. Publish with set_lifecycle. Lifecycle is draft -> review -> published -> archived -> draft.

Do not invent certifications, customers, or commercial claims. Keep demonstration Northstar Labs content labeled until real content replaces it.

If the current page is another trust center or compliance platform, read that system and write records here. Do not paste a dump.

reset_demo_content requires confirm=true. Uploaded R2 documents are kept across a demo reset.

Housekeeping tools: remove_subscriber deletes an address for good; retry_email requeues an outbox row whose status is failed. Check get_admin_state with sections=["emailOutbox"] or ["subscribers","totals"] first.

Do not click through the admin UI when a tool can do the work.
```

## Local development

On a trusted developer machine:

```bash
cp .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Then connect Cursor or an MCP inspector to `http://127.0.0.1:8787/mcp` with the local admin token. Do not run this on Grok Bot's shared computer.
