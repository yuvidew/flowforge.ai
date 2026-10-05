import { AllFilesContainer, AllFilesError, AllFilesList, AllFilesLoading } from "@/features/all-files/_components/all-files-view";
import { requireAuth } from "@/lib/auth-utils";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense } from "react";


const HomePage = async () => {
  await requireAuth();

  return (
    <AllFilesContainer>
      <ErrorBoundary fallback={<AllFilesError />}>
        <Suspense fallback={<AllFilesLoading />}>
          <AllFilesList />
        </Suspense>
      </ErrorBoundary>
    </AllFilesContainer>
  );
}

export default HomePage;

