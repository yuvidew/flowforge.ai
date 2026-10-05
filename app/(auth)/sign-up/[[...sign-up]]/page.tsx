import { requireUnAuth } from "@/lib/auth-utils";
import { SignUp } from "@clerk/nextjs";

const SignUpPage = async () => {
  await requireUnAuth();
  return (
    <main className="flex items-center justify-center h-screen">
      <SignUp />
    </main>
  );
}

export default SignUpPage;
