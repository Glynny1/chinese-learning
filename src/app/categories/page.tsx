import CategoriesForm from "./categories-form";

type Category = { id: string; name: string };

async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`/api/categories`, { cache: "no-store" });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.categories as Category[]) ?? [];
  } catch {
    return [];
  }
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Categories</h1>
      <CategoriesForm />
      <div className="mt-8 space-y-3">
        {categories.map((c) => (
          <div key={c.id} className="border rounded p-3">{c.name}</div>
        ))}
        {categories.length === 0 && <div className="opacity-70">No categories yet.</div>}
      </div>
    </div>
  );
}
