import { requireUnAuth } from "@/lib/auth-utils";
import { SignIn } from "@clerk/nextjs";

const SignInPage = async () => {
  await requireUnAuth();
  return (
    <main className="flex items-center justify-center h-screen">
      <SignIn />
    </main>
  );
};

export default SignInPage;
