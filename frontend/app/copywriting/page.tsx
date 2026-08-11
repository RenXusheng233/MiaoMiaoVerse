import { CopyWorkspace } from "@/components/copywriting/copy-workspace";
import { getCats } from "@/lib/api";

export default async function CopywritingPage() {
  const cats = await getCats();
  return <CopyWorkspace cats={cats} />;
}
