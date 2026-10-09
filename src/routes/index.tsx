import { createFileRoute } from "@tanstack/react-router";
import { Ionreach } from "@/components/Ionreach";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Ionreach />;
}
