import { notFound } from "next/navigation";

import { CatDetail } from "@/components/cats/cat-detail";
import { getCat } from "@/lib/api";

export default async function CatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cat = await getCat(id);
  if (!cat) {
    notFound();
  }
  return <CatDetail cat={cat} />;
}
