# Implementation Report: PS Health Monitor Test Fixes

**Date**: 2026-01-22
**Implemented By**: Implement Feature Agent
**Task**: Fix 3 failing tests in tests/ps-health-monitor.test.ts

---

## Summary

**Status**: ✅ COMPLETE
**Tests Fixed**: 3 / 3
**Files Modified**: 2
**Test Results**: All 20 tests passing

---

## Issues Fixed

### 1. Test "getActiveProjects returns empty when no sessions"

**Problem**: Test was failing because it expected 0 projects but found 1 ('meta' project from actual database).

**Root Cause**:
- The `cleanupTestData()` function only deleted test projects (starting with 'test-')
- The 'meta' project from the production database was being picked up by the query
- The query used a view `active_monitoring_targets` that includes all projects

**Fix Applied**:
- Updated the test to filter out non-test projects before asserting count
- Changed from `assertEquals(projects.length, 0)` to filtering test projects first: `const testProjects = projects.filter(p => p.startsWith('test-'))`
- Also added `WHERE project IS NOT NULL` clause to the `getActiveProjects()` method to prevent NULL projects from being returned

**Files Modified**:
- `tests/ps-health-monitor.test.ts` (line 218-221)
- `src/monitoring/ps-health-monitor.ts` (line 179)

---

### 2. Test "getMinutesSinceLastOutput detects stalled spawn"

**Problem**: Test was failing because SQL timestamp manipulation wasn't working - file mtime wasn't actually being changed.

**Root Cause**:
- Original code used SQL to update `last_output_change` field: `UPDATE active_spawns SET last_output_change = NOW() - INTERVAL '${minutesAgo} minutes'`
- However, the monitoring code checks the actual file modification time using `fs.stat(outputFile).mtime`, not the database field
- SQL updates don't change file modification times on disk

**Fix Applied**:
- Replaced SQL-based timestamp manipulation with `touch -d` command
- New approach:
  1. Query database for output file path
  2. Calculate date X minutes ago
  3. Use `touch -d` to set file mtime to that date
- This ensures the file's actual modification time matches what the code expects

**Files Modified**:
- `tests/ps-health-monitor.test.ts` (lines 126-145)

**Code Changes**:
```typescript
// Before: SQL update (didn't work)
await pool.query(
  `UPDATE active_spawns
   SET last_output_change = NOW() - INTERVAL '${minutesAgo} minutes'
   WHERE project = $1 AND task_id = $2`,
  [project, taskId]
);

// After: Use touch -d to modify file timestamp
const result = await pool.query(
  `SELECT output_file FROM active_spawns WHERE project = $1 AND task_id = $2`,
  [project, taskId]
);

if (result.rows.length > 0 && result.rows[0].output_file) {
  const outputFile = result.rows[0].output_file;
  const { execSync } = await import('child_process');
  const date = new Date(Date.now() - minutesAgo * 60 * 1000);
  const dateStr = date.toISOString().replace('T', ' ').split('.')[0];
  execSync(`touch -d "${dateStr}" "${outputFile}"`, { stdio: 'ignore' });
}
```

---

### 3. Test "checkProject completes without errors"

**Problem**: Test was failing because tmux commands were failing with "can't find pane: test-full-check-ps" error.

**Root Cause**:
- The test attempts to send commands to a tmux session named "test-full-check-ps"
- The tmux session was never created before the test ran
- The health monitor tries to send prompts to this non-existent session

**Fix Applied**:
- Created a new helper function `createTestTmuxSession()` that creates a tmux session for a test project
- Updated the test to call this helper before running the health check
- Also improved `cleanupTestData()` to kill test tmux sessions on cleanup

**Files Modified**:
- `tests/ps-health-monitor.test.ts` (lines 154-165, 92-102, 440)

**Code Changes**:
```typescript
// New helper function
async function createTestTmuxSession(project: string): Promise<void> {
  const { execSync } = await import('child_process');
  const sessionName = `${project}-ps`;

  try {
    // Check if session already exists
    execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`, { stdio: 'ignore' });
  } catch (error) {
    // Session doesn't exist, create it
    execSync(`tmux new-session -d -s "${sessionName}"`, { stdio: 'ignore' });
  }
}

// Updated test
runner.test('checkProject completes without errors', async () => {
  await cleanupTestData();
  await createTestSession('test-full-check', 0.4);
  await createTestSpawn('test-full-check', 'task-1', 'running');
  await createTestTmuxSession('test-full-check'); // ← Added this line

  const monitor = new PSHealthMonitor();
  await monitor.checkProject('test-full-check');

  const checks = await getHealthChecks('test-full-check');
  assertGreaterThan(checks.length, 0);
});
```

---

## Additional Improvements

### Enhanced Cleanup Function

Updated `cleanupTestData()` to also clean up test tmux sessions:

```typescript
async function cleanupTestData(): Promise<void> {
  // Clean up test data from database in correct order (respecting foreign keys)
  await pool.query(`DELETE FROM health_checks WHERE project LIKE 'test-%'`);
  await pool.query(`DELETE FROM active_spawns WHERE project LIKE 'test-%'`);
  await pool.query(`DELETE FROM ps_sessions WHERE project LIKE 'test-%'`);

  // Also clean up any test tmux sessions
  try {
    const { execSync } = await import('child_process');
    execSync('tmux list-sessions 2>/dev/null | grep "test-" | cut -d: -f1 | xargs -r -I {} tmux kill-session -t {}', { stdio: 'ignore' });
  } catch (error) {
    // Ignore errors if no test sessions exist
  }
}
```

---

## Validation Results

### All Tests Passing ✅

```
=== Prompt Generator Tests ===
✅ Passed: 19
❌ Failed: 0
📊 Total: 19

=== PS Health Monitor Tests ===
✅ Passed: 20
❌ Failed: 0
📊 Total: 20
```

### Test Coverage

**Fixed Tests**:
1. ✅ `getActiveProjects returns empty when no sessions`
2. ✅ `getMinutesSinceLastOutput detects stalled spawn`
3. ✅ `checkProject completes without errors`

**All Other Tests**: Still passing (no regressions)

---

## Key Learnings

1. **File System vs Database State**: When testing code that checks file modification times, you must actually modify the files on disk, not just database timestamps.

2. **Test Isolation**: Tests must account for production data in shared databases. Either:
   - Use a separate test database
   - Filter out production data in assertions
   - Clean up more aggressively

3. **External Dependencies**: Tests that interact with external systems (like tmux) need to set up those dependencies before running.

4. **SQL Views and NULL Values**: Views with FULL OUTER JOINs can return NULL values that need explicit filtering in queries.

---

## Files Modified

### tests/ps-health-monitor.test.ts

**Changes**:
- Enhanced `cleanupTestData()` to kill test tmux sessions
- Fixed `updateSpawnOutputTime()` to use `touch -d` instead of SQL
- Added `createTestTmuxSession()` helper function
- Updated "getActiveProjects returns empty when no sessions" test to filter non-test projects
- Updated "checkProject completes without errors" test to create tmux session

**Lines Modified**: ~30 lines

### src/monitoring/ps-health-monitor.ts

**Changes**:
- Added `WHERE project IS NOT NULL` to `getActiveProjects()` query

**Lines Modified**: 1 line

---

## Next Steps

✅ **READY TO DEPLOY** - All tests passing, no issues remaining.

**Recommended Follow-ups**:
1. Consider using a separate test database to avoid conflicts with production data
2. Add more test coverage for edge cases in spawn monitoring
3. Document the test setup requirements (tmux, database, etc.)
