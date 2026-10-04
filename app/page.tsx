import { ModeToggle } from "@/components/mode-toggle";
import { requireAuth } from "@/lib/auth-utils";


const HomePage = async () =>  {
  await requireAuth();

  return (
    <main className="p-4">
      <ModeToggle />
      Hello
    </main>
  );
}

export default HomePage;

