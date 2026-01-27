# Epic: MacBook Integration

**Epic ID:** 037
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** Mobile App Development Platform

## Business Context

Leverage existing MacBook Intel 2019 for iOS builds via GitHub Actions self-hosted runner. Avoids cloud macOS costs (~$100/month), uses existing hardware.

## Requirements

**MUST HAVE:**
- [ ] SSH tunnel from VM to MacBook
- [ ] GitHub Actions self-hosted runner on MacBook
- [ ] Runner label: "macos-self-hosted"
- [ ] Health monitoring (runner uptime)
- [ ] Automatic restart on failure

**SHOULD HAVE:**
- [ ] VPN/Tailscale for secure connection
- [ ] Wake-on-LAN for MacBook
- [ ] Power monitoring (ensure MacBook plugged in)

## Architecture

**Connection:**
VM ← SSH tunnel → MacBook (GitHub Actions runner)

**Workflow Update:**
```yaml
jobs:
  build-ios:
    runs-on: macos-self-hosted  # Use MacBook instead of cloud
```

**Prerequisites:**
- MacBook always powered on and connected
- SSH keys configured
- Xcode installed
- fastlane installed

## Implementation Tasks

- [ ] Install GitHub Actions runner on MacBook
- [ ] Configure runner as service (auto-start)
- [ ] Set up SSH tunnel from VM
- [ ] Test runner connectivity
- [ ] Update ios-ci.yml to use macos-self-hosted

**Estimated Effort:** 6 hours (0.75 days)

## Acceptance Criteria

- [ ] GitHub Actions runner active on MacBook
- [ ] Workflows use macos-self-hosted label
- [ ] iOS builds execute on MacBook
- [ ] Runner auto-restarts on failure
- [ ] SSH tunnel stable

## Dependencies

**Blocked By:** Epic 032 (iOS Pipeline)
**Prerequisites:** MacBook with Xcode, GitHub Actions runner
