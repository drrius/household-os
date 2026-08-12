import { loadHomeViewModel } from "@/lib/read-models/home";
import { HomeScreen } from "@/ui/home/home-screen";

export default async function HomePage() {
  const model = await loadHomeViewModel();

  return <HomeScreen model={model} />;
}
