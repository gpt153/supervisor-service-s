# Epic: Expo Snack Integration

**Epic ID:** 036
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** Mobile App Development Platform

## Business Context

For mobile UI mockups, integrate with Expo Snack for instant mobile preview. Generate QR code, scan with Expo Go app, test on real device without builds.

## Requirements

**MUST HAVE:**
- [ ] MCP tool: mobile_create_snack({ component_code, project_name })
- [ ] Expo Snack API integration (create snack programmatically)
- [ ] QR code generation
- [ ] Return snack URL + QR code image
- [ ] Auto-update snack on code changes (optional workflow)

**SHOULD HAVE:**
- [ ] Mock data injection for snacks
- [ ] Multi-screen snacks (navigation)
- [ ] Snack versioning

## Architecture

**Flow:**
1. PS requests mobile mockup
2. Generate React Native component from UI design
3. Create Expo Snack via API
4. Return QR code for scanning
5. User scans with Expo Go app → sees mockup on phone

**Integration:** Works alongside UI-First Workflow (Epic 027) for mobile UI

## Implementation Tasks

- [ ] Integrate Expo Snack API
- [ ] ExpoSnackClient.createSnack(code)
- [ ] QR code generation library
- [ ] MCP tool: mobile_create_snack
- [ ] Store snack URLs in ui_mockups (for mobile mockups)

**Estimated Effort:** 6 hours (0.75 days)

## Acceptance Criteria

- [ ] mobile_create_snack creates Expo Snack
- [ ] Returns QR code image for scanning
- [ ] Snack URL accessible
- [ ] Component renders on Expo Go app
- [ ] Changes reflected on re-scan

## Dependencies

**Blocked By:** None (independent)
**Integrates With:** Epic 027 (UI Mockups) for mobile variant
