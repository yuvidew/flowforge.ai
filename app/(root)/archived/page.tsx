import { ArchivedContainer } from "@/features/all-files/_components/archived-view";
import { BoardsList } from "@/features/all-files/_components/boards-view";
import { AllFilesError, AllFilesLoading } from "@/features/all-files/_components/all-files-view";
import { requireAuth } from "@/lib/auth-utils";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";

const ArchivedPage = async () => {
  await requireAuth();

  return (
    // Suspense is required because the search/pagination read the URL via useSearchParams.
    <Suspense fallback={<AllFilesLoading />}>
      <ArchivedContainer>
        <ErrorBoundary fallback={<AllFilesError />}>
          <BoardsList archived />
        </ErrorBoundary>
      </ArchivedContainer>
    </Suspense>
  );
}

export default ArchivedPage;
