# Feature Request: Mobile App Development Platform

**Created:** 2026-01-22
**Status:** Draft
**Complexity:** Level 4 (Very Large Feature)
**Priority:** Medium
**Planning Track:** Enterprise

---

## One-Sentence Summary

A comprehensive mobile app development platform integrated into the SV supervisor system that enables project supervisors to build, test, and deploy iOS and Android applications using PIV loops, Firebase Test Lab for serverless device testing, and GitHub Actions CI/CD - all coordinated through MCP tools with zero manual intervention.

---

## Problem Statement

Currently, the SV system only supports web application development:

1. **No mobile development capability** - PSs cannot build iOS or Android apps
2. **No device testing infrastructure** - Cannot test on real iPhones/iPads/Android devices
3. **No mobile CI/CD** - No automated builds or deployments for mobile platforms
4. **No cross-platform support** - Would need separate codebases for iOS and Android
5. **Hardware constraints** - iOS development requires macOS, which we have (MacBook Intel 2019) but not integrated
6. **No mobile deployment workflow** - No path from epic → implementation → TestFlight/Play Store

This blocks PSs from building mobile applications and limits the types of projects the SV system can handle.

---

## User Impact

**Primary Users:** Project Supervisors (PSs) building mobile applications

**Current Pain Points:**
- PSs cannot build mobile apps at all
- No way to test UI on actual devices
- Must manually set up mobile development environments
- No automated testing on real devices
- Cannot deploy to App Store or Play Store
- Cross-platform development (iOS + Android) requires duplicate work

**Expected Value:**
- **Mobile App Development**: PSs can build iOS and Android apps using PIV loops
- **Real Device Testing**: Automated tests run on actual iPhones and Android devices via Firebase Test Lab
- **Cross-Platform Efficiency**: 70-90% code sharing with React Native or Flutter
- **Automated CI/CD**: Push to GitHub triggers builds and device testing automatically
- **Beta Deployment**: Auto-deploy to TestFlight (iOS) and Play Store Internal Testing (Android)
- **Cost-Effective**: Free tier covers development (60 min/day device testing)

---

## Business Context

**What Happens If We Don't Build This:**
- SV system limited to web applications only
- Cannot build mobile-first products
- Competitors with mobile apps have market advantage
- Miss opportunities for mobile-specific features (push notifications, offline mode, camera access)

**Timeline:** Medium priority - enables new product categories

**Dependencies:**
- Existing PIV loop infrastructure (subagent spawning)
- GitHub integration (already used for code hosting)
- MacBook Intel 2019 (for iOS builds)
- Linux VM (for Android builds)
- Google Cloud / Firebase account
- Apple Developer Program ($99/year)
- Google Play Console ($25 one-time)

---

## Requirements (MoSCoW)

### MUST HAVE (MVP)

**Project Structure Support:**
- Template for React Native projects with .bmad/ structure
- Template for Flutter projects with .bmad/ structure
- CLAUDE.md templates for mobile PSs
- Port allocation for mobile services (development servers, Metro bundler, etc.)

**Android Development:**
- Build APKs on Linux VM using Gradle
- Generate test APKs for instrumentation testing
- Upload to Firebase Test Lab via gcloud CLI
- Run tests on virtual Android devices (Pixel 2, Pixel 5)
- Collect test results, screenshots, videos
- Store results in project directory
- Automated via GitHub Actions (Linux runner)

**iOS Development:**
- Build IPA files on MacBook using Xcode + fastlane
- Generate test bundles for XCUITest
- Upload to Firebase Test Lab via gcloud CLI
- Run tests on iOS devices (iPhone 12, iPhone 14)
- Collect test results, screenshots, videos
- Store results in project directory
- Automated via GitHub Actions (macOS runner)

**Firebase Test Lab Integration:**
- Free tier usage: 60 min/day across both platforms
- Virtual devices for Android (faster, more quota)
- Physical devices for iOS (required)
- Parallel test execution
- Automatic test sharding for faster runs
- JUnit XML result parsing

**PIV Loop Integration:**
- PIV spawns implementation subagent with mobile context
- Subagent writes React Native/Flutter code
- Subagent writes Espresso (Android) and XCUITest (iOS) tests
- Subagent commits code to GitHub
- GitHub Actions triggers automatically
- PS monitors test results from Firebase Test Lab
- PS approves or requests fixes based on device testing

**GitHub Actions Workflows:**
- `.github/workflows/android-ci.yml` - Android builds and tests
- `.github/workflows/ios-ci.yml` - iOS builds and tests
- Triggered on push to main/develop branches
- Triggered on pull requests
- Uses GitHub Secrets for credentials (Firebase, Apple)
- Uploads test artifacts (APK, IPA, results, screenshots)

**MCP Tool Suite (Core):**
1. `mobile_create_project` - Create mobile project structure (React Native or Flutter)
2. `mobile_run_tests` - Trigger Firebase Test Lab tests manually
3. `mobile_get_test_results` - Fetch latest test results
4. `mobile_deploy_beta` - Deploy to TestFlight (iOS) and Play Store Internal (Android)
5. `mobile_list_devices` - List available test devices in Firebase Test Lab

**State Management:**
- Track mobile projects in database (`mobile_projects` table)
- Track test runs (`mobile_test_runs` table)
- Track deployments (`mobile_deployments` table)
- Store GitHub workflow run IDs for correlation

**fastlane Configuration:**
- iOS lane: `build_for_testing` - Build IPA for Firebase Test Lab
- iOS lane: `beta` - Deploy to TestFlight
- Android lane: `beta` - Deploy to Play Store Internal Testing
- Automatic build number incrementing
- Certificate/provisioning profile management

### SHOULD HAVE (v1.1)

**Enhanced MCP Tools:**
6. `mobile_get_crash_reports` - Fetch crash reports from Firebase Crashlytics
7. `mobile_check_quota` - Check Firebase Test Lab quota usage
8. `mobile_preview_app` - Generate QR code for Expo Go testing (React Native only)
9. `mobile_analyze_performance` - Get performance metrics from test runs

**Advanced Testing:**
- Custom test matrices (multiple devices, OS versions, locales, orientations)
- Test result diffing (compare current vs previous runs)
- Screenshot comparison (detect UI regressions)
- Flaky test detection and retries
- Code coverage collection from device tests

**Developer Experience:**
- Local testing setup guide for macOS
- Simulator/emulator setup for development
- Hot reload support for rapid iteration
- Native module integration guides

**Cost Management:**
- Firebase Test Lab cost tracking
- GitHub Actions minutes monitoring
- Budget alerts for test usage
- Optimization recommendations

### COULD HAVE (v2.0)

**Multi-Platform Support:**
- Web deployment of React Native (via React Native Web)
- Desktop builds (via Electron wrapper)
- Single codebase for web + mobile + desktop

**Advanced Device Testing:**
- AWS Device Farm integration (unlimited testing, $250/month)
- BrowserStack App Live integration
- Real device access via web browser

**App Store Optimization:**
- Automated screenshot generation for App Store/Play Store
- Localized app descriptions
- A/B testing for store listings
- Review automation and monitoring

**Analytics Integration:**
- Firebase Analytics setup
- Mixpanel/Amplitude integration
- User behavior tracking from beta tests

### WON'T HAVE (Out of Scope)

**Explicitly Not Building:**
- Native iOS (Swift/Objective-C) only - use cross-platform frameworks
- Native Android (Kotlin/Java) only - use cross-platform frameworks
- Game development (Unity, Unreal) - specialized tooling required
- AR/VR applications - requires specialized hardware
- Custom CI/CD infrastructure - use GitHub Actions
- On-device debugging - use standard Xcode/Android Studio tools
- App Store submission automation - manual review required by Apple/Google

---

## Technical Context

### Current Infrastructure

**Linux VM (E2-standard-8):**
- OS: Ubuntu/Linux
- Docker: Available
- Node.js: Available
- Can run: Android SDK, Gradle, React Native CLI, Flutter SDK
- **Role**: Android builds, Metro bundler, backend services

**MacBook Intel 2019:**
- OS: macOS (required for iOS development)
- Xcode: Will be installed
- fastlane: Will be installed
- **Role**: iOS builds, iOS-specific tooling

**Google Cloud / Firebase:**
- Firebase project: Will be created
- Test Lab: Free tier (60 min/day)
- Crashlytics: Optional for crash reporting
- Cloud Storage: For test result artifacts

**GitHub:**
- Repositories: Already used for code hosting
- Actions: Free tier (2,000 min/month Linux, ~200 min/month macOS)
- Secrets: For Firebase credentials, Apple credentials

**Port Allocation (for development):**
- Consilio: 5000-5099
- Health-Agent: 5100-5199
- OpenHorizon: 5200-5299
- Odin: 5300-5399

**Mobile dev servers (examples):**
- Metro bundler (React Native): 8081 → Remap to project range
- Flutter DevTools: 9100 → Remap to project range
- Local backend: Use project's allocated port

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SV SUPERVISOR SYSTEM                     │
│              /home/samuel/sv/[mobile-project]/               │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   BMAD     │  │   Epics    │  │   PIV      │           │
│  │  Planning  │  │ (Database) │  │   Loops    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                              │
│  PS spawns PIV → PIV spawns subagent → Subagent writes:    │
│  - React Native/Flutter code                                │
│  - UI tests (Espresso/XCUITest)                            │
│  - Unit tests                                               │
│  - Commits to GitHub                                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
                    Push to GitHub
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      GITHUB ACTIONS                          │
│                                                              │
│  ┌──────────────────┐           ┌──────────────────┐       │
│  │  Linux Runner    │           │  macOS Runner    │       │
│  │  (Android Build) │           │  (iOS Build)     │       │
│  │                  │           │                  │       │
│  │  1. Setup JDK 17 │           │  1. Setup Xcode  │       │
│  │  2. Grant gradlew│           │  2. Pod install  │       │
│  │  3. Build APKs   │           │  3. Fastlane     │       │
│  │  4. Upload       │           │  4. Build IPA    │       │
│  │                  │           │  5. Upload       │       │
│  └──────────────────┘           └──────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   FIREBASE TEST LAB                          │
│                     (Serverless Testing)                     │
│                                                              │
│  ┌──────────────────────────────────────────┐              │
│  │  Android Devices        iOS Devices      │              │
│  │  ─────────────────      ────────────     │              │
│  │  • Pixel 2 (API 28)     • iPhone 12      │              │
│  │  • Pixel 5 (API 30)     • iPhone 14      │              │
│  │  • Samsung A10          • iPad Pro        │              │
│  │                                           │              │
│  │  Tests run in parallel, results uploaded │              │
│  │  FREE: 60 min/day per platform           │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    RESULTS & DEPLOYMENT                      │
│                                                              │
│  PS receives via MCP:                                        │
│  ✅ Test status (pass/fail)                                 │
│  📹 Video recordings of test runs                           │
│  📸 Screenshots of UI states                                │
│  📊 JUnit XML results                                       │
│  📈 Performance metrics                                     │
│                                                              │
│  PS analyzes results:                                        │
│  - All tests passing → Deploy to beta                       │
│  - Tests failing → PIV fixes issues, retest                 │
│                                                              │
│  If approved → fastlane deploys:                            │
│  • Android → Google Play Store (Internal Testing)           │
│  • iOS → TestFlight (Beta Testing)                          │
└─────────────────────────────────────────────────────────────┘
```

### Framework Comparison

**React Native (RECOMMENDED for web developers):**
- Language: JavaScript/TypeScript
- Code sharing: 70-90%
- Community: Huge (Facebook-backed)
- Hot reload: Excellent
- Native modules: Extensive ecosystem
- Learning curve: Low if you know React
- **Best for**: Teams with JS/React experience

**Flutter (RECOMMENDED for performance-critical apps):**
- Language: Dart
- Code sharing: 85-95%
- Community: Growing (Google-backed)
- Hot reload: Excellent
- Performance: Better than RN for graphics-heavy apps
- Learning curve: Medium (new language)
- **Best for**: Apps with complex animations, games, custom UI

**Decision:** Support both, let PSs choose based on project needs.

---

## Success Criteria

**Functional:**
- ✓ PS can create mobile project with one MCP call
- ✓ PIV loop can implement mobile features end-to-end
- ✓ Tests run on real devices in Firebase Test Lab
- ✓ Test results available to PS within 20 minutes of commit
- ✓ PS can deploy to TestFlight/Play Store with one MCP call
- ✓ 70-90% code sharing between iOS and Android

**Non-Functional:**
- ✓ Free tier covers development (60 min/day device testing)
- ✓ Build time <10 minutes (Android), <15 minutes (iOS)
- ✓ Test execution <10 minutes on Firebase Test Lab
- ✓ Zero manual intervention for routine builds/tests
- ✓ All test artifacts stored and accessible

**User Experience:**
- ✓ PS doesn't need to understand mobile development details
- ✓ Clear feedback on test failures with screenshots/videos
- ✓ PIV loop handles all mobile-specific boilerplate
- ✓ Beta deployment is one command

---

## Scope Boundaries

**Definitely IN Scope:**
- React Native and Flutter project templates
- Android build pipeline (Linux VM + Gradle)
- iOS build pipeline (MacBook + Xcode + fastlane)
- Firebase Test Lab integration
- GitHub Actions CI/CD workflows
- PIV loop integration for mobile development
- MCP tool suite for mobile operations
- Beta deployment to TestFlight and Play Store Internal
- Test result collection and analysis

**Explicitly OUT of Scope:**
- Native iOS/Android only (must use cross-platform)
- App Store submission automation (manual review required)
- Game development frameworks (Unity, Unreal)
- AR/VR development
- Custom build infrastructure (use GitHub Actions)
- On-device debugging tools (use standard IDEs)
- Production Play Store/App Store deployment (beta only)
- App analytics implementation (can be added per project)

---

## Constraints

**Technical:**
- macOS required for iOS builds (cannot be virtualized)
- Free tier Firebase Test Lab limits: 60 min/day
- GitHub Actions free tier: 2,000 min/month Linux, ~200 min/month macOS
- Apple Developer Program: $99/year subscription required
- Physical devices required for iOS testing (simulators not sufficient for release)

**Operational:**
- MacBook must be accessible for iOS builds (keep powered, network connected)
- Firebase Test Lab quota resets daily (cannot carry over)
- App Store review required for public releases (outside scope)

**Resource:**
- MacBook storage: iOS builds require ~20-50GB (Xcode + simulators)
- Linux VM storage: Android SDK ~10GB
- GitHub repository storage: Build artifacts can be large

---

## Dependencies

**Blockers (Must Exist Before Implementation):**
- ✓ PIV loop infrastructure (exists)
- ✓ Subagent spawning system (exists)
- ✓ GitHub integration (exists for code hosting)
- ✓ Linux VM with Node.js/Docker (exists)
- ✓ MacBook Intel 2019 (exists)
- ⚠ Apple Developer Program enrollment (not yet - $99/year)
- ⚠ Google Play Console enrollment (not yet - $25 one-time)
- ⚠ Firebase project setup (not yet - free)
- ⚠ Firebase Test Lab enabled (not yet - free tier)
- ⚠ GitHub Secrets configured (not yet)

**Parallel Dependencies (Can Build Alongside):**
- Mobile-specific subagent templates (can create during implementation)
- Mobile testing guides (can document during implementation)

**Blocks (Enables Future Work):**
- Mobile-first products
- Cross-platform apps (web + mobile from single codebase)
- Push notification services
- Offline-first applications
- Native device features (camera, GPS, sensors)

---

## Related Features & Context

**Related Documentation:**
- `/home/samuel/supervisor/docs/mobile-app-development-setup.md` (OLD system)
- `/home/samuel/supervisor/docs/ui-workflow-system.md` (UI design workflow)

**Related MCP Tools:**
- `mcp_meta_spawn_subagent` - PIV loop spawning
- `mcp_meta_set_secret` - Store Firebase/Apple credentials
- `mcp_meta_allocate_port` - Port allocation for dev servers

**Integration Points:**
- SecretsManager - Store Firebase service account JSON, Apple credentials
- PortManager - Allocate ports for Metro bundler, dev servers
- PIV Loop - Spawn implementation subagents for mobile features
- GitHub Actions - Trigger builds and tests

---

## Complexity Rationale

**Why Level 4 (Very Large Feature):**

1. **Multi-Platform Complexity**: Android (Linux VM) + iOS (macOS) + cross-platform frameworks
2. **Multiple Integration Points**: Firebase, GitHub Actions, fastlane, Xcode, Gradle, PIV loops
3. **State Management**: Track projects, test runs, deployments across platforms
4. **CI/CD Pipeline**: Complex workflows with device testing, artifact collection
5. **Framework Support**: Must support both React Native and Flutter
6. **External Dependencies**: Apple Developer Program, Google Play, Firebase Test Lab
7. **Hardware Requirements**: Requires MacBook setup and integration
8. **Testing Complexity**: Real device testing on iOS and Android
9. **MCP Tool Suite**: 9+ tools with different permission models
10. **Documentation**: Extensive guides for mobile development, testing, deployment

**Estimated Implementation Time:** 4-6 days

**Recommended Epic Breakdown:**
1. Epic 1: Project templates and structure (React Native + Flutter)
2. Epic 2: Android build pipeline and Firebase Test Lab integration
3. Epic 3: iOS build pipeline and fastlane setup
4. Epic 4: GitHub Actions CI/CD workflows
5. Epic 5: PIV loop integration and subagent templates
6. Epic 6: MCP tool suite for mobile operations
7. Epic 7: Beta deployment automation (TestFlight + Play Store)
8. Epic 8: Test result collection and analysis
9. Epic 9: Documentation and developer guides

---

## Implementation Phases

### Phase 0: Prerequisites (Manual - 1 day)

**Apple Setup:**
- Enroll in Apple Developer Program ($99/year)
- Install Xcode on MacBook (10-15GB download)
- Install fastlane: `sudo gem install fastlane -NV`
- Create App ID and provisioning profiles

**Google Setup:**
- Create Firebase project
- Enable Test Lab API
- Create service account for CI/CD
- Download service account JSON key

**GitHub Setup:**
- Add GitHub Secrets:
  - `FIREBASE_PROJECT_ID`
  - `GOOGLE_CREDENTIALS` (base64-encoded service account JSON)
  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD`

### Phase 1: Foundation (2 days)

**Database Schema:**
- `mobile_projects` table
- `mobile_test_runs` table
- `mobile_deployments` table
- `mobile_devices` table (Firebase Test Lab catalog)

**Project Templates:**
- React Native template with .bmad/ structure
- Flutter template with .bmad/ structure
- CLAUDE.md templates for mobile PSs
- fastlane setup files

**MCP Tools (Core):**
- `mobile_create_project`
- `mobile_list_devices`

### Phase 2: Android Pipeline (1-2 days)

**Android Build:**
- GitHub Actions workflow: `android-ci.yml`
- Gradle configuration for APK + test APK generation
- Firebase Test Lab upload and execution
- Result collection (JUnit XML, screenshots, videos)

**MCP Tools:**
- `mobile_run_tests` (Android support)
- `mobile_get_test_results` (Android support)

### Phase 3: iOS Pipeline (1-2 days)

**iOS Build:**
- fastlane configuration
- GitHub Actions workflow: `ios-ci.yml`
- Xcode build for IPA + test bundle
- Firebase Test Lab upload and execution
- Result collection

**MCP Tools:**
- `mobile_run_tests` (iOS support)
- `mobile_get_test_results` (iOS support)

### Phase 4: PIV Integration (1 day)

**Subagent Templates:**
- Mobile implementation subagent
- React Native code generation patterns
- Flutter code generation patterns
- Espresso test generation
- XCUITest generation

**PIV Workflow:**
- Detect mobile project type
- Spawn mobile-aware subagent
- Commit and push triggers CI/CD
- Monitor Firebase Test Lab results

### Phase 5: Beta Deployment (1 day)

**fastlane Lanes:**
- iOS: `beta` lane for TestFlight
- Android: `beta` lane for Play Store Internal

**MCP Tools:**
- `mobile_deploy_beta`

**Automation:**
- Automatic build number increment
- Certificate management
- Upload and notify

---

## Cost Analysis

### Minimal Setup (Development)

**Required:**
- Apple Developer Program: $99/year
- Google Play Console: $25 one-time
- Firebase Test Lab: FREE (60 min/day)
- GitHub Actions: FREE (2,000 min/month)

**Total Year 1:** $124
**Total Year 2+:** $99/year

### Production Setup (Scaling)

**When You Have Users:**
- AWS Device Farm: $250/month ($3,000/year) for unlimited testing
- Or BrowserStack App Live: $199/month ($2,388/year)
- GitHub Actions Pro: $4/month if exceeding free tier

**Total Production:** ~$3,100-3,500/year

### ROI Calculation

**Cost of NOT having mobile:**
- Lost mobile-first opportunities: Immeasurable
- Competitive disadvantage: Significant
- Manual testing overhead: $500-1000/month (developer time)

**Cost of having mobile:**
- Development: $124/year
- Production: $3,100/year when scaling

**Break-even:** 1-2 mobile app projects justify the investment

---

## Risk Areas

**Technical Risks:**
- iOS code signing complexity (mitigation: fastlane match, clear documentation)
- Firebase Test Lab quota exceeded (mitigation: monitor usage, optimize test duration)
- GitHub Actions macOS runner costs (mitigation: use free tier strategically, consider self-hosted runner)
- MacBook availability for builds (mitigation: keep powered/connected, monitor status)

**Operational Risks:**
- Apple Developer Program renewal lapses (mitigation: calendar reminders)
- Xcode updates break builds (mitigation: pin Xcode version in workflows)
- Test flakiness on real devices (mitigation: retry logic, flaky test detection)

**Business Risks:**
- App Store/Play Store policy changes (mitigation: stay informed, follow guidelines)
- Low adoption by PSs (mitigation: clear documentation, good DX)

---

## Open Questions

**Resolved:**
- ✓ Framework choice: Support both React Native and Flutter
- ✓ Build infrastructure: GitHub Actions (free tier sufficient for development)
- ✓ Device testing: Firebase Test Lab (serverless, cost-effective)
- ✓ iOS builds: Use existing MacBook

**Pending:**
- Should we support native iOS/Android or only cross-platform? → **Only cross-platform**
- Self-hosted GitHub Actions runner on MacBook? → **Evaluate in Phase 2 if free tier exceeded**
- Expo Go workflow for React Native rapid testing? → **Could Have (v2.0)**

---

## Next Steps

1. **Approval Phase:** Review with stakeholders, confirm budget ($99 Apple + $25 Google)
2. **Prerequisites Phase:** Enroll in Apple/Google programs, set up Firebase, configure GitHub Secrets
3. **Planning Phase:** Create comprehensive epic breakdown with database entries
4. **Architecture Phase:** Create ADRs for key decisions:
   - ADR: React Native vs Flutter as default
   - ADR: Firebase Test Lab vs AWS Device Farm
   - ADR: GitHub Actions vs self-hosted runners
5. **Implementation Prep:** Break epics into implementation tasks for PIV loops
6. **Testing Strategy:** Define test scenarios for both platforms
7. **Documentation:** Create mobile development guides for PSs

---

## Notes

**Key Insights:**
- Cross-platform frameworks eliminate 50-70% duplication
- Firebase Test Lab free tier is generous for development
- GitHub Actions macOS runners expensive but sufficient for beta testing
- PIV loops can handle mobile complexity if given proper templates

**Success Factors:**
- Clear documentation for PSs (most won't know mobile development)
- Good test coverage (real device testing catches bugs early)
- Fast feedback loops (20 minutes commit-to-results is acceptable)
- Cost monitoring (free tier limits require awareness)

**Future Enhancements:**
- Expo Go integration for instant mobile previews
- Screenshot comparison for UI regression testing
- Performance benchmarking on devices
- Crash reporting and analytics setup
- Multi-language support and localization

---

**Analyst:** Claude Sonnet 4.5 (Meta-Supervisor)
**Review:** Ready for Planning Phase - Epic Creation
