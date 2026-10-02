import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createAppLoggerToStream, logSecurityAlert } from "../../../lib/logger.js";


describe("Phase 8.4.2 — Security Log Anomaly Alerting", () => {
  it("emits structured JSON log with event SECURITY_ALERT, alertType, ipAddress, and timestamp", () => {
    const logs: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs.push(chunk.toString());
        callback();
      }
    });

    const logger = createAppLoggerToStream(stream);

    logSecurityAlert(logger, {
      alertType: "FAILED_AUTH_BURST",
      ipAddress: "103.21.244.2",
      userId: "user-buyer-1",
      path: "/api/v1/auth/buyer/verify-otp",
      message: "Multiple failed OTP attempts detected from IP",
      details: { attempts: 3 }
    });

    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.event).toBe("SECURITY_ALERT");
    expect(parsed.alertType).toBe("FAILED_AUTH_BURST");
    expect(parsed.ipAddress).toBe("103.21.244.2");
    expect(parsed.userId).toBe("user-buyer-1");
    expect(parsed.path).toBe("/api/v1/auth/buyer/verify-otp");
    expect(parsed.details).toEqual({ attempts: 3 });
    expect(parsed.msg).toContain("[SECURITY_ALERT] Multiple failed OTP attempts detected from IP");
  });
});
