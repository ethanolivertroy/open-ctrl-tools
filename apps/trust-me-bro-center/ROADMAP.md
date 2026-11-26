# Roadmap

Features that were considered and set aside for now. None of them is promised. Each one is small enough to land on its own, and each one earns its place only when a real deployment needs it.

## Notifications

- **Subscriber groups.** Tag subscribers so an update can go to a subset, for example customers on one plan or one region. Today every confirmed subscriber gets every published update.
- **Targeted and repeat sends.** Choose recipients per update (everyone, selected groups, extra addresses, or nobody) and resend a published update later. Today an update emails once, on first publish.
- **Outbound webhooks.** Signed HTTP callbacks when an access request is received, approved, or denied, so a CRM or ticketing system can react. Today those events show up in admin, the audit log, and MCP.

## Viewers

- **Resend an access link.** Rotate a viewer's token and email the new link without removing and re-adding them.
- **Viewer activity.** Record page views, resource views and downloads, and video plays per viewer, with an admin panel and filters. Useful for telling a sales team which prospect opened what. Deliberately absent so far because the page should not feel like it tracks the reader.

## Access requests

- **Separate history view.** Split approved and denied requests from the pending list once volume makes one list noisy. Today one list shows pending requests first.

## Profile

- **Marketplace and listing links.** Optional footer links to cloud marketplace listings or third-party attestations.
- **Custom domain reporting.** Surface the hostname the trust center is served from in the public profile for clients that mirror it.

## Not on this list

Evidence collection, control monitoring, audit workflows, vendor scoring, scheduled publishing, and a role system beyond Access identities and viewer links. See the README overview for scope boundaries.
