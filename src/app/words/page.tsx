import { WordsForm } from "./words-form";
import WordsListClient from "./words-list-client";

export default async function WordsPage() {
  return (
    <div className="max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Words</h1>
      <WordsForm />
      <WordsListClient />
    </div>
  );
}
