import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENGINE_V2_SAMPLE } from "./document.ts";
import {
  approveEngineTransactionProposal,
  commitEngineTransactionProposal,
  createEngineTransactionProposal,
  fingerprintEngineDocument,
  rejectEngineTransactionProposal,
} from "./transaction-kernel.ts";

describe("engine transaction proposals", () => {
  it("previews, approves, and commits a reversible change", () => {
    const base = structuredClone(ENGINE_V2_SAMPLE);
    const forward = { ...base, name: "AI revision" };
    const created = createEngineTransactionProposal(base, forward, "ai", "proposal-1");
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.proposal.state, "draft");
    assert.equal(created.proposal.inverseDocument.name, base.name);
    assert.equal(created.proposal.summary.fields.includes("name"), true);

    const approved = approveEngineTransactionProposal(created.proposal);
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    const committed = commitEngineTransactionProposal(approved.proposal, base);
    assert.equal(committed.ok, true);
    if (!committed.ok) return;
    assert.equal(committed.proposal.state, "committed");
    assert.equal(committed.proposal.forwardDocument.name, "AI revision");
  });

  it("rejects stale commits and rejected proposals", () => {
    const base = structuredClone(ENGINE_V2_SAMPLE);
    const created = createEngineTransactionProposal(base, { ...base, name: "Proposed" }, "ai", "proposal-2");
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const approved = approveEngineTransactionProposal(created.proposal);
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    const stale = { ...base, name: "Concurrent edit" };
    assert.equal(commitEngineTransactionProposal(approved.proposal, stale).ok, false);

    const rejected = rejectEngineTransactionProposal(created.proposal);
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    assert.equal(approveEngineTransactionProposal(rejected.proposal).ok, false);
  });

  it("fingerprints equivalent documents deterministically", () => {
    const copy = JSON.parse(JSON.stringify(ENGINE_V2_SAMPLE));
    assert.equal(fingerprintEngineDocument(ENGINE_V2_SAMPLE), fingerprintEngineDocument(copy));
  });
});
