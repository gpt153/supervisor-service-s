# ADR-003: Health Monitoring Frequency and Auto-Restart Strategy

**Status:** Accepted
**Date:** 2026-01-19
**Decision Maker:** Architect Agent
**Related Epic:** [005-tunnel-manager.md](../epics/005-tunnel-manager.md)
**Related ADR:** [001-sqlite-for-tunnel-state.md](001-sqlite-for-tunnel-state.md)
**Review Date:** 2026-04-19 (3 months)

---

## Context

The tunnel-manager must ensure the Cloudflare tunnel stays healthy and operational. Since the tunnel is **critical infrastructure** (all PS web services depend on it), downtime directly impacts all projects.

### Current Situation

- Cloudflare tunnel runs as either systemd service or Docker container
- Tunnel can fail due to: process crash, network issues, configuration errors, cloudflared bugs
- Currently: No automated health monitoring
- Currently: No automated restart on failure
- Impact: When tunnel fails, all services become unreachable until manual intervention

### The Challenge

We need to answer two critical questions:

**Question 1: How often should we check tunnel health?**
- Too frequent: Wastes CPU/resources, creates log noise
- Too infrequent: Slow to detect failures, longer outages

**Question 2: When and how should we restart the tunnel?**
- Trigger conditions: When to restart?
- Retry strategy: How many times? How long between attempts?
- Restart method: Graceful vs forceful?
- Failure threshold: How many failed checks before restarting?

### Forces at Play

**Reliability Requirements:**
- Target uptime: 99.9% (MAX 43 minutes downtime per month)
- Auto-recovery critical (no manual intervention for routine failures)
- Must restart quickly (minimize downtime)
- Must not restart unnecessarily (avoid service disruption)

**Performance Requirements:**
- Health monitoring overhead <1% CPU (per epic)
- Check frequency must not impact system performance
- Restart must complete in <60 seconds (per epic)

**Operational Requirements:**
- Must notify PSs when tunnel goes down/up
- Must log all restart attempts (audit trail)
- Must handle persistent failures gracefully (not infinite tight loop)
- Must work for both systemd and Docker deployments

**Risk Management:**
- False positives: Don't restart healthy tunnel
- Cascading failures: Don't create restart loops
- Persistent issues: Detect when restart won't help
- State preservation: Don't lose CNAME mappings during restart

---

## Decision

### Health Monitoring Frequency

**We will check tunnel health every 30 seconds.**

**Health Check Implementation:**
```typescript
async function checkTunnelHealth(): Promise<HealthStatus> {
  // Check 1: Process existence
  const processRunning = await checkProcess();
  if (!processRunning) {
    return { status: 'down', reason: 'process_not_running' };
  }

  // Check 2: Connectivity test
  const isConnected = await testConnectivity();
  if (!isConnected) {
    return { status: 'down', reason: 'connectivity_failed' };
  }

  return { status: 'up' };
}

// Run every 30 seconds
setInterval(checkTunnelHealth, 30000);
```

**Process Check:**
- For systemd: `systemctl is-active cloudflared` (exit code 0 = running)
- For Docker: `docker ps | grep cloudflared` (present in list = running)

**Connectivity Test:**
- HTTP request to cloudflare status endpoint OR
- TCP connection test to tunnel port OR
- Check cloudflare metrics API

### Auto-Restart Strategy

**We will use a 3-strike failure detection with exponential backoff retries.**

**Failure Detection:**
- Restart trigger: 3 consecutive failed health checks (90 seconds total)
- Rationale: Avoids false positives from transient network blips

**Retry Strategy:**
- Attempt 1: Restart immediately
- Attempt 2: Wait 5 seconds, restart
- Attempt 3: Wait 15 seconds, restart
- Attempt 4: Wait 30 seconds, restart
- Attempt 5: Wait 1 minute, restart
- Attempt 6+: Wait 5 minutes, restart
- Continue forever (unlimited retries)

**Restart Method:**
```typescript
async function restartTunnel(): Promise<void> {
  try {
    // 1. Graceful shutdown (allow in-flight requests to complete)
    await gracefulShutdown(); // SIGTERM, wait 10s

    // 2. Force kill if still running
    await forceKill(); // SIGKILL if needed

    // 3. Start tunnel
    await startTunnel();

    // 4. Wait for health
    await waitForHealthy(60000); // Max 60s

    // 5. Notify PSs
    emitEvent('tunnel_up');

  } catch (error) {
    logError(error);
    emitEvent('tunnel_restart_failed', error);
    // Will retry per exponential backoff schedule
  }
}
```

**Implementation:**
- For systemd: `systemctl restart cloudflared`
- For Docker: `docker restart cloudflared --time 10` (10s grace period)

**Notifications:**
- Emit MCP events: `tunnel_down`, `tunnel_restarting`, `tunnel_up`, `tunnel_restart_failed`
- PSs can subscribe to events and react (pause deployments, alert users, etc.)

---

## Rationale

### Health Monitoring Frequency: 30 Seconds

#### ✅ Pros

1. **Fast Failure Detection:**
   - 3 checks = 90 seconds to detect and trigger restart
   - + 60 seconds max restart time
   - = 150 seconds total worst-case recovery (2.5 minutes)
   - Well within 99.9% uptime target

2. **Low Resource Overhead:**
   - 2 checks per minute = 120 checks per hour
   - Each check ~10ms = 1.2 seconds per hour = 0.03% CPU
   - Well below <1% overhead requirement

3. **Balanced Responsiveness:**
   - Not so frequent to cause noise
   - Not so infrequent to miss failures
   - Industry standard for health checks

4. **Practical Implementation:**
   - Simple setInterval(fn, 30000)
   - Easy to test and debug
   - Clear logs (2 entries per minute)

#### ❌ Cons

1. **Detection Latency:**
   - Worst case: 90 seconds to detect failure (3 x 30s checks)
   - **Mitigation:** Acceptable trade-off for avoiding false positives
   - **Mitigation:** Most failures detected on first check (30s latency)

2. **Resource Usage:**
   - Continuous background process
   - **Mitigation:** 0.03% CPU is negligible
   - **Mitigation:** SQLite writes batched (not every check)

#### Why 30 Seconds Wins

**Alternatives Evaluated:**

| Frequency | Detection Time | Checks/Hour | CPU % | Assessment |
|-----------|----------------|-------------|-------|------------|
| 5 seconds | 15s (3 checks) | 720 | ~0.2% | Too frequent, log noise |
| 10 seconds | 30s (3 checks) | 360 | ~0.1% | Acceptable, but marginal |
| **30 seconds** | **90s (3 checks)** | **120** | **~0.03%** | **Optimal balance** |
| 60 seconds | 180s (3 checks) | 60 | ~0.015% | Too slow to detect |
| 5 minutes | 15min (3 checks) | 12 | ~0.003% | Unacceptable latency |

30 seconds is the **Goldilocks frequency**: fast enough to detect failures quickly, slow enough to avoid overhead and false positives.

### Failure Detection: 3-Strike Rule

#### ✅ Pros

1. **Avoids False Positives:**
   - Single failed check might be transient network blip
   - 3 consecutive failures = real problem
   - Prevents unnecessary restarts (service disruption)

2. **Fast Enough:**
   - 90 seconds to detect = acceptable for non-critical infrastructure
   - Tunnel downtime won't crash services (they queue requests briefly)

3. **Predictable Behavior:**
   - Clear rule: 3 strikes → restart
   - Easy to understand and debug
   - Simple state machine (count failures)

#### ❌ Cons

1. **90 Second Detection Latency:**
   - Services might experience 90s of errors before restart
   - **Mitigation:** Most failures detected immediately (process crash = first check fails)
   - **Mitigation:** Cloudflare queues requests briefly during tunnel downtime

2. **All-or-Nothing:**
   - No graduated response (warning → error → restart)
   - **Mitigation:** Can add warning events after 1-2 failures (future enhancement)

#### Why 3 Strikes Wins

**Alternatives Evaluated:**

| Threshold | Pros | Cons | Assessment |
|-----------|------|------|------------|
| 1 strike | Fastest detection | Too many false positives | Rejected |
| 2 strikes | Fast, fewer false positives | Still prone to transient issues | Acceptable |
| **3 strikes** | **Balanced, reliable** | **Slight delay** | **Optimal** |
| 5 strikes | Very few false positives | 150s detection too slow | Rejected |

3 strikes is **industry standard** for health checks (AWS ELB, Kubernetes, etc.). Proven pattern.

### Restart Strategy: Exponential Backoff with Unlimited Retries

#### ✅ Pros

1. **Handles Transient Failures:**
   - Quick restart for simple crashes (5s → 15s → 30s)
   - Backs off for persistent issues (up to 5 min intervals)
   - Prevents tight restart loops

2. **Never Gives Up:**
   - Unlimited retries = tunnel will eventually recover
   - Critical infrastructure must always attempt recovery
   - Manual intervention only for persistent, unrecoverable issues

3. **Resource Friendly:**
   - Exponential backoff prevents resource exhaustion
   - 5 minute cap prevents excessive backoff
   - Logs not flooded with restart attempts

4. **Graceful Handling:**
   - SIGTERM allows in-flight requests to complete
   - 10 second grace period before SIGKILL
   - Minimizes service disruption

#### ❌ Cons

1. **Persistent Failures Not Detected:**
   - Will keep trying forever even if restart won't help
   - **Mitigation:** Logs track restart attempts (ops can see pattern)
   - **Mitigation:** Alert after N failures (future enhancement)

2. **Slow Recovery for Persistent Issues:**
   - After 5 failed restarts, waiting 5 minutes between attempts
   - **Mitigation:** If issue is persistent, fast retry won't help anyway
   - **Mitigation:** Ops alerted to investigate

3. **Potential for Resource Churn:**
   - Restart process uses resources (start/stop overhead)
   - **Mitigation:** Backoff reduces frequency
   - **Mitigation:** systemd/docker handle process lifecycle efficiently

#### Why Unlimited Retries with Exponential Backoff Wins

**Key Principle:** The tunnel is **critical infrastructure**. It must always attempt recovery.

**Alternatives Evaluated:**

| Strategy | Pros | Cons | Assessment |
|----------|------|------|------------|
| Fixed 30s retry | Simple | Tight loop for persistent failures | Rejected |
| **Exponential backoff** | **Balanced** | **Complexity** | **Optimal** |
| Max 10 retries, then give up | Prevents resource waste | Tunnel stays down permanently | Rejected |
| Exponential with cap at 1 hour | Prevents excessive backoff | 1 hour too long for recoverable issues | Rejected |

Exponential backoff is **industry standard** for retry logic (AWS, GCP, Kubernetes). 5-minute cap balances responsiveness with resource efficiency.

---

## Consequences

### Positive Consequences

1. **High Availability:**
   - 99.9% uptime achievable (150s worst-case recovery)
   - Auto-recovery handles routine failures
   - No manual intervention needed for common issues

2. **Low Overhead:**
   - <0.1% CPU for health monitoring
   - Minimal impact on system performance
   - Health checks run silently in background

3. **Fast Recovery:**
   - Most failures detected within 30-90 seconds
   - Restart completes within 60 seconds
   - Total downtime typically <3 minutes

4. **Prevents False Positives:**
   - 3-strike rule avoids unnecessary restarts
   - Exponential backoff prevents restart loops
   - Graceful shutdown minimizes disruption

5. **Complete Visibility:**
   - All health checks logged to SQLite
   - All restart attempts logged to audit_log
   - MCP events notify PSs of status changes

### Negative Consequences

1. **Detection Latency:**
   - 90 seconds to detect failures (3 x 30s)
   - PSs experience errors during this window
   - **Impact:** Low - Cloudflare queues requests briefly

2. **Restart Disruption:**
   - Brief downtime during restart (~5-30 seconds)
   - In-flight requests may be dropped
   - **Impact:** Low - Rare restarts, graceful shutdown helps

3. **Persistent Failure Handling:**
   - Will retry forever even if restart won't help
   - Requires manual intervention for unrecoverable issues
   - **Impact:** Low - Ops alerted via logs, rare scenario

4. **Resource Usage:**
   - Background process runs constantly
   - Database writes every 30 seconds
   - **Impact:** Negligible - <0.1% CPU, <1KB/check

### Neutral Consequences

1. **Operational Procedures:**
   - Ops must monitor restart patterns
   - Ops must investigate after multiple restarts
   - Standard ops practice, not better or worse

2. **PS Impact:**
   - PSs notified of tunnel status changes
   - PSs can react (pause deployments, etc.)
   - Adds complexity but also visibility

---

## Alternatives Considered

### Alternative 1: More Frequent Monitoring (10 Seconds)

**Description:** Check health every 10 seconds, 3-strike rule = 30s detection.

**Pros:**
- ✅ Faster detection (30s vs 90s)
- ✅ Quicker recovery (90s vs 150s worst case)

**Cons:**
- ❌ 6x more checks (0.18% CPU vs 0.03%)
- ❌ 6x more database writes
- ❌ 6x more log entries
- ❌ Higher risk of false positives (less time for transient recovery)

**Why Rejected:**

Marginal benefit (60s faster detection) not worth 6x overhead increase. 90s detection is acceptable for non-critical infrastructure.

### Alternative 2: Less Frequent Monitoring (60 Seconds)

**Description:** Check health every 60 seconds, 3-strike rule = 180s detection.

**Pros:**
- ✅ Lower overhead (0.015% CPU)
- ✅ Fewer logs
- ✅ Less database writes

**Cons:**
- ❌ Slower detection (180s vs 90s)
- ❌ Slower recovery (240s vs 150s worst case)
- ❌ Longer downtime per incident

**Why Rejected:**

60s savings in detection time is meaningful. 3 minutes is noticeable downtime for users. 30s frequency worth the marginal overhead.

### Alternative 3: Adaptive Frequency

**Description:** Start at 10s interval. If healthy for 1 hour, slow to 30s. If healthy for 24 hours, slow to 60s.

**Pros:**
- ✅ Fast detection when issues likely (after recent failure)
- ✅ Low overhead when stable

**Cons:**
- ❌ Complex state machine
- ❌ Unpredictable behavior (frequency changes)
- ❌ Harder to debug
- ❌ Premature optimization

**Why Rejected:**

Complexity not justified. 30s fixed frequency is simple and sufficient. If overhead becomes issue in production, reconsider.

### Alternative 4: Single-Strike Restart

**Description:** Restart immediately on first failed health check (no 3-strike rule).

**Pros:**
- ✅ Fastest possible detection (30s)
- ✅ Fastest possible recovery (90s worst case)

**Cons:**
- ❌ High false positive rate (transient network blips)
- ❌ Unnecessary restarts cause brief downtime
- ❌ Restart churn impacts stability

**Why Rejected:**

False positives are worse than detection latency. Restarting a healthy tunnel (due to transient network issue) creates unnecessary downtime. 3-strike rule prevents this.

### Alternative 5: Max 10 Retries, Then Alert and Stop

**Description:** After 10 failed restart attempts, stop trying and alert ops.

**Pros:**
- ✅ Prevents infinite retry for unrecoverable issues
- ✅ Forces ops intervention
- ✅ Conserves resources

**Cons:**
- ❌ Tunnel stays down permanently
- ❌ If issue resolves (network restored), tunnel won't recover
- ❌ Manual intervention required even for recoverable issues

**Why Rejected:**

**The tunnel is critical infrastructure.** It must always attempt recovery. If network outage lasts 4 hours, tunnel should recover when network returns - not require manual restart.

Ops can monitor restart patterns and intervene if needed, but system should never give up.

### Alternative 6: Kubernetes-Style Liveness/Readiness Probes

**Description:** Separate "liveness" (is process alive?) and "readiness" (is service accepting traffic?) checks.

**Pros:**
- ✅ More granular health understanding
- ✅ Can route around "alive but not ready" instances

**Cons:**
- ❌ Complex for single-instance deployment
- ❌ No multiple instances to route between
- ❌ Overkill for this use case

**Why Rejected:**

Kubernetes-style probes are designed for multi-instance, load-balanced deployments. Our tunnel is single-instance. Combined liveness+connectivity check is sufficient.

---

## Implementation Plan

### Phase 1: Health Monitoring (Issue #3)

1. **Create HealthMonitor class:**
   ```typescript
   class HealthMonitor extends EventEmitter {
     private failureCount = 0;
     private intervalHandle: NodeJS.Timeout;

     async start(): Promise<void> {
       this.intervalHandle = setInterval(() => this.check(), 30000);
     }

     private async check(): Promise<void> {
       const status = await this.checkHealth();

       await this.database.insertHealthSnapshot(status);

       if (status.status === 'down') {
         this.failureCount++;

         if (this.failureCount >= 3) {
           this.emit('tunnel_failed');
           this.failureCount = 0; // Reset for next cycle
         }
       } else {
         if (this.failureCount > 0) {
           // Recovered before hitting 3 failures
           this.failureCount = 0;
         }
       }
     }
   }
   ```

2. **Implement health check methods:**
   - `checkProcess()`: systemctl is-active OR docker ps
   - `testConnectivity()`: HTTP request OR TCP connect
   - Return `{ status: 'up' | 'down', reason?: string }`

3. **Store health snapshots:**
   - Insert row to `tunnel_health` table every 30s
   - Prune old entries (keep last 7 days)

### Phase 2: Auto-Restart (Issue #4)

4. **Create RestartManager class:**
   ```typescript
   class RestartManager {
     private restartCount = 0;
     private backoffIntervals = [0, 5000, 15000, 30000, 60000, 300000]; // ms

     async restart(): Promise<void> {
       const backoff = this.getBackoff();

       if (backoff > 0) {
         await this.sleep(backoff);
       }

       try {
         await this.gracefulShutdown();
         await this.forceKill();
         await this.start();
         await this.waitForHealthy(60000);

         this.emit('tunnel_up');
         this.restartCount = 0; // Reset on success

       } catch (error) {
         this.emit('tunnel_restart_failed', error);
         this.restartCount++;
         // Will retry on next health failure
       }
     }

     private getBackoff(): number {
       const index = Math.min(this.restartCount, this.backoffIntervals.length - 1);
       return this.backoffIntervals[index];
     }
   }
   ```

5. **Implement restart methods:**
   - Detect deployment: systemd OR docker
   - For systemd: `systemctl restart cloudflared`
   - For docker: `docker restart cloudflared --time 10`

6. **Implement graceful shutdown:**
   - Send SIGTERM
   - Wait 10 seconds
   - If still running, send SIGKILL

### Phase 3: Event Notifications

7. **Emit MCP events:**
   - `tunnel_down`: When 3 failures detected
   - `tunnel_restarting`: When restart begins
   - `tunnel_up`: When restart succeeds
   - `tunnel_restart_failed`: When restart fails

8. **PS subscription:**
   - PSs can subscribe to events via MCP
   - React to tunnel status (pause deploys, alert users, etc.)

### Phase 4: Monitoring & Alerting

9. **Logging:**
   - Log all health checks (if failure)
   - Log all restart attempts
   - Store in `audit_log` table

10. **Metrics:**
    - Track uptime percentage
    - Track restart count
    - Track mean-time-to-recovery
    - Expose via MCP tool: `tunnel_get_metrics`

---

## Success Metrics

Measure after 30 days:

### Quantitative Metrics

- [ ] **Uptime:** 99.9% or better (MAX 43 minutes downtime)
- [ ] **Detection Speed:** p95 failure detection <90 seconds
- [ ] **Recovery Speed:** p95 auto-recovery <150 seconds (detection + restart)
- [ ] **Overhead:** Health monitoring <0.1% CPU
- [ ] **False Positives:** <1 unnecessary restart per month

### Qualitative Metrics

- [ ] **Reliability:** PSs report high service availability
- [ ] **Transparency:** PSs find event notifications useful
- [ ] **Debugging:** Logs provide clear picture of tunnel health

### Decision Validation

- [ ] **Review after 3 months:** Is 30s frequency optimal?
- [ ] **Review after 3 months:** Is 3-strike rule working well?
- [ ] **Review after 3 months:** Are there persistent failures we're not handling?

---

## Related Decisions

- **ADR-001:** SQLite for Tunnel State - Health metrics stored in SQLite
- **ADR-002:** Ingress Target Selection - Docker connectivity affects health checks

---

## References

- **Epic 005:** [005-tunnel-manager.md](../epics/005-tunnel-manager.md)
- **AWS Health Checks:** https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
- **Kubernetes Probes:** https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- **Exponential Backoff:** https://cloud.google.com/iot/docs/how-tos/exponential-backoff
- **SRE Book - Monitoring:** https://sre.google/sre-book/monitoring-distributed-systems/

---

## Notes

### Why Not Alert Instead of Auto-Restart?

Some systems alert ops instead of auto-restarting. We chose auto-restart because:

1. **Routine Failures:** Most tunnel failures are routine (crashes, network blips). Auto-restart handles these.
2. **Downtime Sensitivity:** Every minute of downtime impacts all PSs. Waiting for ops intervention takes longer.
3. **Ops Burden:** Manual restarts create toil. Auto-restart reduces ops workload.

Ops can still be alerted (future enhancement: alert after N restart attempts), but auto-restart should be first response.

### Graceful Shutdown Importance

SIGTERM allows cloudflared to:
- Complete in-flight requests (tunnel connections)
- Flush buffers
- Clean up resources

SIGKILL is immediate termination, can leave connections in bad state. Always try SIGTERM first.

### Health Check vs Metrics

Health checks answer: "Is the tunnel up?"
Metrics answer: "How well is the tunnel performing?"

This ADR focuses on health checks (binary up/down). Metrics (request latency, error rate, etc.) are future enhancements (v1.1).

---

**Author:** Claude Sonnet 4.5 (Architect Agent)
**Approved By:** [Pending]
**Implementation Status:** Ready for Epic 005 Issues #3 and #4
**Next Review:** 2026-04-19
