import { STAGE_IDS, STAGE_LABELS } from "../../server/types";
import type { StageId, StageRecord } from "../../server/types";

type Props = {
  stages: Record<StageId, StageRecord>;
  onView?: (stage: StageId) => void;
  hasArtifact?: (stage: StageId) => boolean;
};

export function StageRail({ stages, onView, hasArtifact }: Props) {
  return (
    <div className="rail">
      {STAGE_IDS.map((id) => {
        const record = stages[id] ?? { status: "pending" as const };
        const cls =
          record.status === "running" || record.status === "awaiting-approval"
            ? "rail-row active"
            : record.status === "failed"
              ? "rail-row failed"
              : record.status === "done"
                ? "rail-row done"
                : "rail-row";

        return (
          <div className={cls} key={id}>
            <span className={`dot ${record.status}`} aria-hidden />
            <span className="stage">
              {id} {STAGE_LABELS[id]}
            </span>
            <span className="smalltext muted ms">
              {record.ms ? `${(record.ms / 1000).toFixed(1)}s` : "—"}
            </span>
            <span className="note">{record.note ?? record.status}</span>
            {onView && hasArtifact?.(id) ? (
              <button className="small" onClick={() => onView(id)}>
                view
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
    </div>
  );
}
