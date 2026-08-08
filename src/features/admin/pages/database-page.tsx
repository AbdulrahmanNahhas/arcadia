import { useState } from "react";
import { createDefaultViewState, type LibraryViewState } from "@/features/library/library-state";
import { LibraryViewPage } from "@/features/library/library-view";

export function AdminDatabasePage() {
  const [viewId, setViewId] = useState<string>();
  const [workId, setWorkId] = useState<string>();
  const [state, setState] = useState<LibraryViewState>(() => createDefaultViewState());
  return (
    <div className="flex min-w-0 flex-col gap-0">
      <LibraryViewPage
        embedded
        viewId={viewId}
        workId={workId}
        initialState={state}
        onStateChange={setState}
        onViewChange={setViewId}
        onWorkChange={setWorkId}
      />
    </div>
  );
}
