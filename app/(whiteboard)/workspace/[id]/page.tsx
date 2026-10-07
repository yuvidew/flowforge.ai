import { WorkSpace, WorkspaceError, WorkspaceLoading, WorkspaceView } from '@/features/workspace/_components/workspace-view'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary';
import "./index.css"
import { requireAuth } from '@/lib/auth-utils';

const WorkspaceId = async () => {
  await requireAuth();
  return (
    <WorkspaceView>
      <ErrorBoundary fallback={<WorkspaceError />}>
        <Suspense fallback={<WorkspaceLoading />}>
          <WorkSpace/>
        </Suspense>
      </ErrorBoundary>
    </WorkspaceView>
  )
}

export default WorkspaceId;
