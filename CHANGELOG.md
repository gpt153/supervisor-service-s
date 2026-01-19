# Changelog

All notable changes to supervisor-service will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### EPIC-005: Cloudflare Integration (2026-01-18)
- Added CloudflareManager class for DNS and tunnel management
- Implemented DNS record operations (create, update, delete, list)
- Added support for CNAME and A record types
- Implemented tunnel ingress synchronization with port allocations
- Added automatic cloudflared configuration generation
- Implemented multi-domain support (153.se, openhorizon.cc)
- Added MCP tools: create_cname, create_a_record, delete_dns_record, list_dns_records, sync_tunnel
- Implemented rate limit handling with automatic retry
- Added IPv4 address validation
- Integrated with SecretsManager for API credentials
- Added comprehensive error handling and logging
- Created Cloudflare TypeScript types
- Added axios dependency (^1.7.9)

#### EPIC-008: Instruction Management (Previous)
- Layered instruction management system (EPIC-008 Phase 1)
- InstructionAssembler class for CLAUDE.md generation
- Core instruction templates (.supervisor-core/)
- Meta-specific instruction templates (.supervisor-meta/)
- Assembly script (assemble-claude.ts)
- Regeneration script with preservation (regenerate-claude.ts)
- Batch update script (update-all-supervisors.ts)
- Verification script (verify-instruction-system.ts)
- Comprehensive documentation for instruction system
- Quick reference guide for common operations
- npm scripts: assemble, regenerate, update-all, verify

### Changed
- README.md updated with instruction management section
- .gitignore updated to exclude .claude-specific/
- CLAUDE.md now auto-generated (do not edit directly)

### Documentation
- docs/INSTRUCTION-SYSTEM.md - Comprehensive guide (470+ lines)
- docs/EPIC-008-IMPLEMENTATION.md - Implementation summary
- docs/QUICK-REFERENCE.md - Quick reference card
- src/instructions/README.md - Instruction system README

## [1.0.0] - 2026-01-18

### Added
- Initial MCP server implementation
- Fastify-based HTTP server
- PostgreSQL database integration
- Health check endpoint
- Tool routing system
- Request/response logging with Pino
- Error handling and validation
- Graceful shutdown support
- TypeScript with strict typing
- Systemd service file
