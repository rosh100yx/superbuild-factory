import type { BuildState } from "../../server/types";

export function TasteReport({ taste }: { taste?: BuildState["taste"] }) {
  if (!taste) return null;

  const verdictClass = taste.verdict === "SHIP" ? "SHIP" : "FIX";

  return (
    <div>
      <div className="row-flex">
        <span className={`verdict ${verdictClass}`}>{taste.verdict}</span>
        <span className="smalltext muted">
          deterministic lint · {taste.errors} error(s) · {taste.warnings} warning(s)
        </span>
      </div>

      {taste.findings.length > 0 ? (
        <table className="findings">
          <thead>
            <tr>
              <th>sev</th>
              <th>rule</th>
              <th>where</th>
              <th>message</th>
            </tr>
          </thead>
          <tbody>
            {taste.findings.map((finding, index) => (
              <tr key={`${finding.rule}-${index}`}>
                <td className={`sev-${finding.severity}`}>{finding.severity}</td>
                <td className="mono">{finding.rule}</td>
                <td className="mono muted">
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ""}
                </td>
                <td>{finding.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="smalltext muted" style={{ marginBottom: 0 }}>
          No findings. Clean.
        </p>
      )}
    </div>
  );
}
