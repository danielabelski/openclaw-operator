import { AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { apiErrorMessage } from "@/lib/api-error";

interface ApiErrorNoticeProps {
  error: unknown;
  fallback: string;
}

export function ApiErrorNotice({ error, fallback }: ApiErrorNoticeProps) {
  const requestId = error instanceof ApiError ? error.requestId : null;

  return (
    <div className="warning-banner" role="alert">
      <AlertTriangle className="w-4 h-4 text-status-error mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-status-error font-mono break-words">
          {apiErrorMessage(error, fallback)}
        </p>
        {requestId && (
          <p className="text-[9px] text-muted-foreground font-mono mt-1 break-all">
            Request ID: {requestId}
          </p>
        )}
      </div>
    </div>
  );
}
