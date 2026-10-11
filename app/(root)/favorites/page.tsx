import { FavoritesContainer } from "@/features/all-files/_components/favorites-view";
import { BoardsList } from "@/features/all-files/_components/boards-view";
import { AllFilesError, AllFilesLoading } from "@/features/all-files/_components/all-files-view";
import { requireAuth } from "@/lib/auth-utils";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";

const FavoritesPage = async () => {
  await requireAuth();

  return (
    // Suspense is required because the search/pagination read the URL via useSearchParams.
    <Suspense fallback={<AllFilesLoading />}>
      <FavoritesContainer>
        <ErrorBoundary fallback={<AllFilesError />}>
          <BoardsList archived={false} pinned />
        </ErrorBoundary>
      </FavoritesContainer>
    </Suspense>
  );
}

export default FavoritesPage;
