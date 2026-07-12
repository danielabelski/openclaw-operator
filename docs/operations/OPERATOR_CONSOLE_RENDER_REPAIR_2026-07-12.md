# Operator Console Render Repair — 2026-07-12

## Runtime diagnosis

Authenticated development-mode reproduction against the live orchestrator on
`127.0.0.1:3312` confirmed that both failing endpoints returned `200`
`application/json` responses. Authentication and transport were not the cause.

The frontend normalization layer recursively attached an enumerable `__raw`
property to every object. Pages that deliberately rendered numeric records
with `Object.entries()` therefore received one extra entry whose value was the
complete original object.

- Business Value attempted to render the raw score-components object.
- Knowledge attempted to render the raw freshness-band object.

`normalizeObject()` now keeps `__raw` available for diagnostics as a
non-enumerable property. Record iteration therefore sees only the declared API
fields. Operator routes also have a render error boundary, and page-level API
failures use a shared error notice that preserves safe request diagnostics.

## Authentication contract

- Protected requests use `Authorization: Bearer <token>`.
- The browser stores the explicitly authenticated credential under
  `openclaw.operator.token` and logout removes it.
- `API_KEY_ROTATION` is the preferred JSON list of active key records. Each
  record carries the credential plus label, role, version/position, activation,
  and expiry metadata. It is not a key identifier and is not itself entered in
  the login form.
- `API_KEY` is used only when no valid rotation-list entries were loaded.

No credential was renamed or rotated for this repair.

## OpenClaw Control UI integration findings

The installed main UI is owned by the `openclaw` npm package
(`openclaw/openclaw`, installed version `2026.6.11`). Its Control UI is shipped
as package-owned compiled assets and should not be patched in place.

The plugin SDK provides backend tools, commands, HTTP routes, session actions,
and generic `PluginControlUiDescriptor` registrations. The descriptor contract
contains metadata (`surface`, `label`, `placement`, JSON schema and scopes), but
it does not define a plugin-owned frontend route, navigation item, JavaScript
bundle, iframe panel, or URL mount. The installed Control UI bundle also does
not currently consume the `plugins.uiDescriptors` gateway method as a route or
navigation extension.

Hosted embeds are supported inside assistant messages. They are sandboxed,
external absolute URLs are blocked by default, and they do not provide a
persistent main-navigation integration or shared operator authentication.

The existing `orchestrator-bridge` is the supported integration surface today:
it exposes `/orch` plus bounded `operator_*` tools and uses the companion API
contracts. It keeps the orchestrator API authoritative and avoids copying
business logic into OpenClaw.

## Integration decision

Direct Control UI mounting is deferred. No supported frontend route/navigation
extension was proven for the installed version.

Recommended order:

1. Keep OpenClaw Control UI/chat plus `/orch` as the primary daily front door.
2. Keep `/operator` as the separate specialist console and use a governed link
   when a supported navigation-link descriptor becomes available.
3. If one-origin access becomes necessary, use a narrowly scoped reverse proxy
   only after defining gateway-to-operator authentication and CSRF/origin
   boundaries. Do not expose the operator bearer token to the Control UI.
4. Avoid a shared-shell build or core-UI fork; both couple this repo to
   OpenClaw's private frontend bundle and create upgrade debt.
