# ADR 011: Firebase Test Lab vs AWS Device Farm

**Status:** Accepted
**Date:** 2026-01-22
**Context:** Mobile App Development Platform
**Related Epic:** 034 (Firebase Test Lab)

## Decision

**Firebase Test Lab for MVP** (free tier: 60 min/day)

## Rationale

**Firebase Test Lab:**
- ✅ Free tier: 60 min/day (~1800 min/month)
- ✅ Serverless (no infrastructure)
- ✅ Easy integration (gcloud CLI)
- ✅ Real devices + virtual
- ❌ Limited free quota

**AWS Device Farm:**
- ✅ Unlimited testing
- ✅ More device options
- ❌ $250/month minimum
- ❌ More complex setup

**Decision:**
- Start with Firebase (sufficient for development)
- Migrate to AWS if exceeding 60 min/day
- Monitor quota via MCP tool

## Cost Analysis

**Firebase:**
- Free: 60 min/day = $0
- Paid: $1/device-hour after quota

**AWS:**
- $250/month unlimited

**Recommendation:** Firebase until hitting quota, then evaluate.
