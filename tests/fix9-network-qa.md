# Fix 9 network timeout QA

Manual device checks for the bounded network-request change:

- Start with the Operations endpoint stalled or unreachable. The board must leave the loading state after the request timeout, show the offline reason, and keep standard contracts playable.
- Open one run trace and immediately open another. The earlier trace request must be aborted/ignored; only the latest selection may populate the trace panel.
- Stall a run-trace response. The trace panel must report that the request timed out while the rest of Operations remains usable.
- Stall telemetry upload after extraction. Local rewards/progression must remain banked and the debrief must move from uplink-sharing to an uplink-delayed error state instead of hanging indefinitely.
- Abort an in-flight Operations request by unmounting the app surface. The abort must not be reported as an offline failure to a dead component.
- Verify the normal online path still loads Operations, run traces, and successful telemetry without timeout/error copy.
