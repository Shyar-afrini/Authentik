import { describe, expect, it } from "vitest";
import { StripServerFieldsPipe } from "./strip-server-fields.pipe";

const pipe = new StripServerFieldsPipe();
const body = { type: "body" } as never;

describe("StripServerFieldsPipe", () => {
  it("drops server-owned fields and tenant ids at every depth", () => {
    const out = pipe.transform(
      {
        id: "x",
        organizationId: "other-org",
        createdBy: "spoof",
        name: "Acme",
        items: [{ organizationId: "other-org", sku: "A", id: "keep-line-id" }],
      },
      body,
    );
    expect(out).toEqual({ name: "Acme", items: [{ sku: "A", id: "keep-line-id" }] });
  });

  it("leaves params and non-objects alone", () => {
    expect(pipe.transform({ id: "1" }, { type: "param" } as never)).toEqual({ id: "1" });
    expect(pipe.transform("abc", body)).toBe("abc");
  });
});
