import { requireAuth } from "@/lib/auth-utils";


const HomePage = async () =>  {
  await requireAuth();

  return (
    <main className="p-4">
      Hello
    </main>
  );
}

export default HomePage;

