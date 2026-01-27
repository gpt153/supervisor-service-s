# ADR-002: Ingress Target Selection Algorithm (localhost vs Container Name)

**Status:** Accepted
**Date:** 2026-01-19
**Decision Maker:** Architect Agent
**Related Epic:** [005-tunnel-manager.md](../epics/005-tunnel-manager.md)
**Related ADR:** [001-sqlite-for-tunnel-state.md](001-sqlite-for-tunnel-state.md)
**Review Date:** 2026-04-19 (3 months)

---

## Context

When a Project Supervisor (PS) requests a CNAME for their service, tunnel-manager must add an ingress rule to `/etc/cloudflared/config.yml` specifying where to route traffic. The ingress target can be:

**Option A:** `http://localhost:PORT` - Route to host port
**Option B:** `http://container-name:PORT` - Route directly to container via Docker network

**The Challenge:**

Different deployment scenarios require different targets:

1. **Scenario 1: Host-based service**
   - Service runs directly on VM (not containerized)
   - Cloudflared runs on host (systemd service)
   - **Must use:** `localhost:PORT`

2. **Scenario 2: Container in shared network**
   - Service runs in Docker container
   - Cloudflared runs in Docker container
   - Both on same Docker network
   - **Optimal:** `container-name:PORT` (no port binding needed)

3. **Scenario 3: Container with port binding**
   - Service runs in Docker container
   - Port exposed with `-p HOST_PORT:CONTAINER_PORT`
   - Cloudflared on host OR different network
   - **Must use:** `localhost:HOST_PORT`

4. **Scenario 4: Container unreachable**
   - Service runs in Docker container
   - No shared network with cloudflared
   - No port binding to host
   - **Error:** Cannot route (must provide recommendation)

**Decision Question:** What algorithm should tunnel-manager use to automatically select the optimal ingress target?

### Forces at Play

**Correctness:**
- Wrong target = service unreachable (silent failure)
- Must detect containerization reliably
- Must validate connectivity before creating CNAME

**Performance:**
- Container-name routing avoids port binding overhead
- Container-name routing more secure (no host exposure)
- But only works if shared network exists

**Developer Experience:**
- PSs shouldn't need to specify target manually
- Clear error messages if connectivity fails
- Recommendations guide PSs to fix issues

**Reliability:**
- Must handle edge cases (container stops, network changes)
- Must work across all Docker deployment patterns
- Fallback strategies for ambiguous cases

---

## Decision

**We will implement intelligent, automatic target selection based on Docker topology analysis.**

**Algorithm:**

```typescript
async function selectIngressTarget(port: number, project: string): Promise<IngressTarget> {
  // 1. Detect cloudflared location
  const cloudflared = await detectCloudflared();

  // 2. Find what's listening on the port
  const hostService = await checkHostPort(port);
  const containerService = await findContainerByPort(port, project);

  // 3. Decision tree
  if (hostService && !containerService) {
    // Host-based service
    return {
      target: `http://localhost:${port}`,
      type: 'localhost',
      reason: 'Service running directly on host'
    };
  }

  if (containerService && cloudflared.type === 'container') {
    // Both containerized - check network connectivity
    const sharedNetwork = findSharedNetwork(
      containerService.networks,
      cloudflared.networks
    );

    if (sharedNetwork) {
      // OPTIMAL: Direct container routing
      return {
        target: `http://${containerService.name}:${port}`,
        type: 'container',
        network: sharedNetwork,
        reason: 'Using container network for optimal performance'
      };
    } else if (containerService.hostPort) {
      // Fallback: Use host port binding
      return {
        target: `http://localhost:${containerService.hostPort}`,
        type: 'localhost',
        reason: 'Using host port binding (no shared network)',
        warning: 'Consider adding cloudflared to container network for better performance'
      };
    } else {
      // ERROR: No connectivity path
      throw new ConnectivityError(
        `Cannot reach container ${containerService.name}`,
        'Add cloudflared to network OR expose port with -p flag'
      );
    }
  }

  if (containerService && cloudflared.type === 'host') {
    // Cloudflared on host, service in container
    if (containerService.hostPort) {
      return {
        target: `http://localhost:${containerService.hostPort}`,
        type: 'localhost',
        reason: 'Cloudflared on host, using exposed container port'
      };
    } else {
      throw new ConnectivityError(
        `Container ${containerService.name} must expose port`,
        'Add -p ${port}:${port} to docker run command'
      );
    }
  }

  // Default: assume host-based
  return {
    target: `http://localhost:${port}`,
    type: 'localhost',
    reason: 'Default routing (assuming host-based service)'
  };
}
```

**Key Principles:**

1. **Prefer container-name over localhost** when both cloudflared and service share a Docker network
2. **Validate connectivity** before creating CNAME (reject if unreachable)
3. **Provide actionable errors** with specific recommendations when connectivity fails
4. **Fallback to localhost** when Docker state is ambiguous or unavailable
5. **Track Docker topology** (networks, containers, ports) in SQLite for fast lookups

---

## Rationale

### ✅ Pros of Container-Name Routing (When Possible)

1. **Better Performance:**
   - Direct container-to-container routing via Docker network
   - No port binding overhead (Linux bridge vs NAT)
   - Lower latency (~0.1ms internal network vs ~0.5ms localhost)

2. **Better Security:**
   - Ports not exposed to host network
   - Service accessible only within Docker network
   - Reduced attack surface

3. **Simpler Configuration:**
   - No `-p` flag needed in docker run
   - No port conflict management on host
   - Port can be reused across different networks

4. **More Scalable:**
   - Supports service discovery patterns
   - Easier to add load balancing later
   - Standard practice in container orchestration

### ✅ Pros of Intelligent Selection

1. **Zero Manual Configuration:**
   - PSs don't specify localhost vs container
   - System determines optimal routing automatically
   - Reduces cognitive load for PSs

2. **Handles All Scenarios:**
   - Host-based services work
   - Containerized services work
   - Mixed deployments work

3. **Clear Error Messages:**
   - Detects unreachable services before creating CNAME
   - Provides specific fix recommendations
   - Prevents silent failures

4. **Future-Proof:**
   - Algorithm can evolve as Docker usage patterns change
   - Can add heuristics for edge cases
   - Can support new deployment patterns (Kubernetes, etc.)

### ❌ Cons (and Mitigations)

1. **Complexity:**
   - Algorithm more complex than "always use localhost"
   - **Mitigation:** Well-tested, comprehensive unit tests for all scenarios
   - **Mitigation:** Clear documentation of decision tree

2. **Docker API Dependency:**
   - Requires Docker API access (dockerode)
   - **Mitigation:** Graceful fallback to localhost if Docker unreachable
   - **Mitigation:** Polls Docker every 60s, cached in SQLite for fast access

3. **Potential for Misdetection:**
   - Edge cases might be mis-classified
   - **Mitigation:** Connectivity validation before CNAME creation (test reachability)
   - **Mitigation:** Manual override option if needed (future enhancement)

4. **Debugging Difficulty:**
   - "Why did it choose localhost instead of container?" questions
   - **Mitigation:** Return detailed `reason` and `warning` in result
   - **Mitigation:** Log decision rationale to audit_log

### Why This Algorithm Wins

**Primary Factor: Correctness**

The algorithm MUST produce correct, working ingress targets. Silent failures (CNAME created but service unreachable) are unacceptable. By:
1. Detecting cloudflared location
2. Finding service location (host vs container)
3. Validating network connectivity
4. Testing reachability before committing

We ensure correctness across all deployment patterns.

**Secondary Factor: Performance Optimization**

When possible, prefer container-name routing for better performance and security. But never sacrifice correctness for optimization - fallback to localhost when connectivity uncertain.

**Tertiary Factor: Developer Experience**

PSs should not need to understand Docker networking internals. The system should "just work" regardless of deployment pattern, with clear guidance when manual intervention needed.

---

## Consequences

### Positive Consequences

1. **Optimal Performance by Default:**
   - Container-name routing used when available
   - No unnecessary port bindings
   - Lowest possible latency

2. **Prevents Silent Failures:**
   - Connectivity validated before CNAME creation
   - Unreachable services rejected with clear errors
   - No "created but doesn't work" scenarios

3. **Great Developer Experience:**
   - PSs don't think about localhost vs container
   - Works for all deployment patterns
   - Clear error messages guide fixes

4. **Security by Default:**
   - Prefers non-exposed ports when possible
   - Reduces host network exposure
   - Follows container security best practices

5. **Future-Proof:**
   - Algorithm can be enhanced over time
   - Can add support for new patterns
   - Manual override path available if needed

### Negative Consequences

1. **Complex Implementation:**
   - DockerNetworkIntel class ~400 lines of code
   - Multiple detection heuristics to maintain
   - More unit tests required (test all 4 scenarios)

2. **Docker API Dependency:**
   - Requires dockerode library
   - Requires Docker socket access
   - Adds external dependency that could fail

3. **Debugging Complexity:**
   - "Why did it choose this target?" investigations
   - Need detailed logging of decision rationale
   - PSs might not understand container networking

4. **Performance Overhead:**
   - Docker API calls to detect topology
   - **Mitigated:** Cached in SQLite, polled every 60s
   - **Mitigated:** Fast lookups from database

### Neutral Consequences

1. **Docker-Specific Logic:**
   - Algorithm assumes Docker
   - Would need rework for Kubernetes/other orchestrators
   - But that's out of scope for MVP

2. **Explicit Error Handling:**
   - Must handle many edge cases
   - More error paths to test
   - But better than silent failures

---

## Alternatives Considered

### Alternative 1: Always Use Localhost

**Description:** Always use `http://localhost:PORT` regardless of deployment pattern. Require PSs to expose container ports with `-p` flag.

**Pros:**
- ✅ Simplest implementation (~50 lines of code)
- ✅ No Docker API dependency
- ✅ Works for both host and container services
- ✅ Easy to debug (always know what target will be)

**Cons:**
- ❌ Suboptimal performance (unnecessary port binding overhead)
- ❌ Security issue (all ports exposed to host)
- ❌ Port conflicts on host (100 CNAMEs = 100 exposed ports)
- ❌ Not best practice for containerized services
- ❌ No detection of unreachable services (silent failures possible)

**Why Rejected:**

While simple, this approach sacrifices too much:
- **Performance:** Port binding adds latency
- **Security:** Unnecessary host exposure
- **Correctness:** No validation = silent failures possible

The complexity of intelligent selection is worth it for correctness and performance gains.

### Alternative 2: PS Specifies Target Manually

**Description:** PS provides `target` parameter in `tunnel_request_cname`: either "localhost" or "container:<name>".

**Pros:**
- ✅ No guessing - PS knows their deployment
- ✅ Simpler implementation (no detection logic)
- ✅ Explicit is better than implicit (Zen of Python)
- ✅ Easy to debug (PS chose the target)

**Cons:**
- ❌ Cognitive load on PS (must understand Docker networking)
- ❌ Error-prone (PS might choose wrong target)
- ❌ Still no connectivity validation (PS might specify unreachable target)
- ❌ Verbose API (more parameters to remember)
- ❌ Against goal of PS autonomy (requires Docker expertise)

**Why Rejected:**

Goes against the core goal of tunnel-manager: **enable PS autonomy without requiring infrastructure expertise**. PSs should focus on their project, not Docker networking internals.

Manual specification could be added as advanced override option later, but shouldn't be the default.

### Alternative 3: Try Container, Fallback to Localhost

**Description:** Always try container-name first. If it fails (404/timeout), fallback to localhost.

**Pros:**
- ✅ Optimistic approach - prefers container-name
- ✅ Automatic fallback for host services
- ✅ Simpler than full detection algorithm

**Cons:**
- ❌ Creates CNAME before knowing it works (bad UX)
- ❌ Requires active probing (health check delays)
- ❌ False negatives (container slow to start = wrongly uses localhost)
- ❌ Tunnel reload churn (try, fail, reload with different target)
- ❌ Silent failures if both fail

**Why Rejected:**

"Try and see" approach is not robust enough. Better to validate connectivity BEFORE creating CNAME. Avoids churn and provides immediate feedback to PS.

### Alternative 4: Heuristic-Based (No Docker API)

**Description:** Use heuristics without Docker API:
- If port bound to 0.0.0.0 → localhost
- If port only bound to container → container-name
- Detect via `netstat` or `/proc/net/tcp`

**Pros:**
- ✅ No Docker API dependency
- ✅ Works even if Docker socket unavailable
- ✅ Faster (no Docker API calls)

**Cons:**
- ❌ Incomplete information (can't see container names)
- ❌ Can't detect Docker networks
- ❌ Can't validate connectivity paths
- ❌ Heuristics fragile (OS-specific)
- ❌ No way to map ports to project ownership

**Why Rejected:**

Heuristics are too fragile and incomplete. Docker API provides ground truth about container topology. Worth the dependency for accuracy.

---

## Implementation Plan

### Phase 1: Docker Detection (Issue #2)

1. **Create DockerNetworkIntel class:**
   ```typescript
   class DockerNetworkIntel {
     async detectCloudflared(): Promise<CloudflaredLocation>
     async findContainerByPort(port: number, project: string): Promise<Container | null>
     async checkHostPort(port: number): Promise<boolean>
     async findSharedNetwork(containerNetworks: string[], cfNetworks: string[]): Promise<string | null>
     async validateConnectivity(target: IngressTarget): Promise<boolean>
   }
   ```

2. **Implement polling:**
   - Poll Docker every 60 seconds
   - Store results in SQLite (docker_networks, docker_containers tables)
   - Cache for fast lookups during CNAME requests

3. **Container-to-project mapping:**
   - Use naming convention: `{project}-{service}` → extract project
   - Use labels if present: `com.supervisor.project=consilio`
   - Store in `docker_containers.project_name` column

### Phase 2: Target Selection (Issue #7)

4. **Implement selection algorithm:**
   - Follow decision tree from this ADR
   - Return IngressTarget with target, type, reason, warning
   - Throw ConnectivityError with specific recommendation

5. **Connectivity validation:**
   - For localhost targets: try HTTP request or netcat
   - For container targets: check shared network exists
   - Test before creating CNAME

6. **Error handling:**
   - Clear error messages for each failure scenario
   - Specific recommendations (add to network, expose port, etc.)
   - Log decision rationale to audit_log

### Phase 3: Testing

7. **Unit tests for all 4 scenarios:**
   - Test: Host-based service → localhost
   - Test: Container in shared network → container-name
   - Test: Container with port binding → localhost
   - Test: Container unreachable → error with recommendation

8. **Integration tests:**
   - Deploy real containers in different network configurations
   - Verify target selection matches expectations
   - Verify connectivity validation works

### Phase 4: Monitoring & Iteration

9. **Track metrics:**
   - Percentage of CNAMEs using localhost vs container-name
   - Connectivity validation success rate
   - False positives (incorrect target selection)

10. **Iterate based on data:**
    - Add heuristics for common patterns
    - Improve error messages based on user feedback
    - Add manual override option if needed

---

## Success Metrics

Measure after 30 days:

### Quantitative Metrics

- [ ] **Accuracy:** 100% of CNAME creations succeed (no unreachable services)
- [ ] **Performance:** Docker topology detection <100ms (p95)
- [ ] **Optimization:** >50% of containerized services use container-name routing (not localhost)
- [ ] **Reliability:** Zero false negatives (reachable service incorrectly rejected)

### Qualitative Metrics

- [ ] **Developer Experience:** PSs report "it just works" for both host and container services
- [ ] **Error Messages:** When failures occur, PSs successfully fix based on recommendations
- [ ] **Debugging:** Logs provide clear rationale for target selection decisions

### Decision Validation

- [ ] **Review after 3 months:** Has algorithm handled all real-world deployment patterns?
- [ ] **Review after 3 months:** Are there edge cases we missed?
- [ ] **Review after 3 months:** Do PSs need manual override option?

---

## Related Decisions

- **ADR-001:** SQLite for Tunnel State - Docker topology stored in SQLite
- **ADR-003 (future):** Health Monitoring Frequency - affects how often we poll Docker

---

## References

- **Epic 005:** [005-tunnel-manager.md](../epics/005-tunnel-manager.md)
- **Docker Networking:** https://docs.docker.com/network/
- **Dockerode Library:** https://github.com/apocas/dockerode
- **Cloudflare Tunnel Ingress:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/configuration/local-management/ingress/

---

## Notes

### Why Not Just Ask the PS?

It's tempting to add a `target: 'localhost' | 'container:<name>'` parameter and let PSs decide. But this:
1. Requires PSs to understand Docker networking (cognitive load)
2. Is error-prone (PSs might choose wrong option)
3. Doesn't validate connectivity (PS might specify unreachable target)

Auto-detection is more work upfront but provides better UX.

### When to Add Manual Override

If we see evidence of:
- PSs frustrated by incorrect auto-detection
- Edge cases we can't detect reliably
- Need for advanced routing options

Then add manual `targetOverride` parameter as escape hatch. But it should be rare.

### Container Name Resolution

Docker's embedded DNS resolver handles `container-name` → IP resolution within networks. This is standard Docker functionality, not magic. When cloudflared makes request to `http://consilio-web:3105`, Docker DNS resolves `consilio-web` to the container's IP on that network.

---

**Author:** Claude Sonnet 4.5 (Architect Agent)
**Approved By:** [Pending]
**Implementation Status:** Ready for Epic 005 Issue #2 and #7
**Next Review:** 2026-04-19
