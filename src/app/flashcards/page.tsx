import FlashcardsFetch from "./flashcards-fetch";

export default async function FlashcardsPage() {
  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Flashcards</h1>
      <FlashcardsFetch />
    </div>
  );
}
