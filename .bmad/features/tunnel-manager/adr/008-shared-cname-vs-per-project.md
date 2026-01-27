# ADR 008: Shared CNAME vs Per-Project CNAMEs

**Status:** Accepted
**Date:** 2026-01-22
**Context:** UI-First Development Workflow
**Related Epic:** 030 (Shared CNAME Infrastructure)

## Context

Need to expose UI tooling (Storybook, dev mockups) via HTTPS. Two approaches:
1. **Shared CNAME**: ui.153.se with path-based routing (/project/tool)
2. **Per-Project CNAMEs**: consilio-storybook.153.se, odin-storybook.153.se

## Decision

**Shared CNAME: ui.153.se with nginx reverse proxy**

URL Structure:
- ui.153.se/consilio/storybook → Consilio's Storybook
- ui.153.se/consilio/dev → Consilio's dev mockup
- ui.153.se/odin/storybook → Odin's Storybook

## Rationale

**Shared CNAME Advantages:**
- ✅ Single DNS entry (no DNS changes per project)
- ✅ Clean URL structure
- ✅ Scalable (add projects without DNS churn)
- ✅ Easier to remember (one domain)
- ✅ nginx reverse proxy is standard pattern

**Per-Project CNAME Advantages:**
- ✅ Isolated per project
- ✅ Shorter URLs

**Why Shared Wins:**
- User requested: "cant we have a general cname for all?"
- Reduces operational overhead (no DNS changes)
- Standard reverse proxy pattern (widely understood)

## Consequences

**Positive:**
- No CNAME creation per project
- Clear URL namespace
- Easy to add/remove projects

**Negative:**
- nginx becomes single point of failure
- Path-based routing slightly more complex
- Longer URLs

**Mitigation:**
- nginx health monitoring
- Graceful reload on config changes
- Clear documentation

## Implementation

**nginx on port 8080:**
```nginx
location /consilio/storybook/ {
    proxy_pass http://localhost:5050/;
}
location /consilio/dev/ {
    proxy_pass http://localhost:5051/;
}
```

**CNAME:**
ui.153.se → localhost:8080 (via Cloudflare tunnel)
