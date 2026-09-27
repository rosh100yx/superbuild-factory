type Props = {
  status: string;
  busy: boolean;
  error: string | null;
  previewUrl?: string;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalGate({ status, busy, error, previewUrl, onApprove, onReject }: Props) {
  if (status !== "awaiting-approval") return null;

  return (
    <div className="gate">
      <div className="row-flex">
        <span className="verdict SHIP">SHIP</span>
        <span className="smalltext muted">
          taste passed. Nothing deploys until you approve.
        </span>
      </div>

      {previewUrl && (
        <p className="smalltext muted mono" style={{ marginBottom: 0 }}>
          target project: {previewUrl}
        </p>
      )}

      <div className="row">
        <button className="primary" disabled={busy} onClick={onApprove}>
          APPROVE DEPLOY
        </button>
        <button className="danger" disabled={busy} onClick={onReject}>
          REJECT
        </button>
        {busy && <span className="smalltext muted">working…</span>}
      </div>

      {error && (
        <p className="err-text" style={{ marginBottom: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
