import { describe, expect, it } from "vitest";

import { failActiveStage, initialStages } from "../src/server/types";

describe("failActiveStage", () => {
  it("marks the running stage as failed, leaving the rest alone", () => {
    const stages = initialStages();
    stages.S1 = { status: "done" };
    stages.S2 = { status: "running" };

    const next = failActiveStage(stages, "Model provider rejected the credentials");

    expect(next.S2.status).toBe("failed");
    expect(next.S2.note).toContain("credentials");
    expect(next.S1.status).toBe("done");
    expect(next.S3.status).toBe("pending");
  });

  it("also catches a stage blocked at the approval gate", () => {
    const stages = initialStages();
    stages.S5 = { status: "awaiting-approval" };
    expect(failActiveStage(stages, "rejected").S5.status).toBe("failed");
  });

  it("is a no-op when nothing is in flight", () => {
    const stages = initialStages();
    expect(failActiveStage(stages, "boom")).toEqual(stages);
  });

  it("does not mutate its input", () => {
    const stages = initialStages();
    stages.S3 = { status: "running" };
    failActiveStage(stages, "boom");
    expect(stages.S3.status).toBe("running");
  });

  it("truncates a long reason so the rail stays readable", () => {
    const stages = initialStages();
    stages.S1 = { status: "running" };
    expect(failActiveStage(stages, "x".repeat(500)).S1.note).toHaveLength(160);
  });
});
