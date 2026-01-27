# ADR 010: React Native vs Flutter as Default Framework

**Status:** Accepted
**Date:** 2026-01-22
**Context:** Mobile App Development Platform
**Related Epic:** 031 (Project Setup)

## Decision

**Support both, recommend React Native as default**

## Rationale

**React Native:**
- ✅ JavaScript/TypeScript (same as web)
- ✅ 70-90% code sharing
- ✅ Huge ecosystem (npm packages)
- ✅ Easier for web developers
- ✅ Expo for rapid prototyping
- ❌ Performance overhead
- ❌ Platform-specific code needed

**Flutter:**
- ✅ Better performance (compiled to native)
- ✅ Beautiful UI out-of-box
- ✅ Hot reload excellent
- ❌ Dart language (new for most)
- ❌ Smaller ecosystem

**Default = React Native** because:
- Most SV developers know JavaScript
- Leverage existing React knowledge
- Larger community support

But support Flutter for projects needing performance.

## Implementation

```typescript
mobile_create_project({
  framework: "react-native" // or "flutter"
})
```
