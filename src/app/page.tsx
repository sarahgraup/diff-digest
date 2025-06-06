"use client"; // Mark as a Client Component

import { useState } from "react";

// Define the expected structure of a diff object
interface DiffItem {
  id: string;
  description: string;
  diff: string;
  url: string; // Added URL field
}

// Define the expected structure of the API response
interface ApiResponse {
  diffs: DiffItem[];
  nextPage: number | null;
  currentPage: number;
  perPage: number;
}

export default function Home() {
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [initialFetchDone, setInitialFetchDone] = useState<boolean>(false);
  const [selectedDiff, setSelectedDiff] = useState<DiffItem | null>(null);
  const [devNotes, setDevNotes] = useState<string>("");
  const [marketingNotes, setMarketingNotes] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);



  const generateNotes = async (diff: DiffItem) => {
    setSelectedDiff(diff);
    setDevNotes("");
    setMarketingNotes("");
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diff: diff.diff,
          description: diff.description,
        }),
      });
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch {
          // Ignore if response body is not JSON
          console.warn("Failed to parse error response as JSON");
        }
        throw new Error(errorMsg);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is null");
      }

      //parse streaming json repsonse
      const decoder = new TextDecoder();
      let jsonText = "";
      let currentDevText = "";
      let currentMarketingText = "";
      let isDevSection = false;
      let isMarketingSection = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        jsonText += text;

        // Look for section markers
        if (text.includes("developer")) {
          isDevSection = true;
        }
        if (text.includes("marketing")) {
          isDevSection = false;
          isMarketingSection = true;
        }
        // Process text based on section 
        if (isDevSection && !isMarketingSection) {
          // Remove JSON syntax chars and add to current
          const cleanText = text.replace(/"developer"\s*:\s*"/, "");
          currentDevText += cleanText;
          setDevNotes(currentDevText);
        }
        if (isMarketingSection) {
          // Remove JSON syntax chars and add to current
          const cleanText = text.replace(/"marketing"\s*:\s*"/, "");
          currentMarketingText += cleanText;
          setMarketingNotes(currentMarketingText);
        }

        try {
          const data = JSON.parse(jsonText);
          if (data.developer) {
            setDevNotes(data.developer);
          }
          if (data.marketing) {
            setMarketingNotes(data.marketing);
          }
        } catch (error) {
          // Expected - JSON is incomplete during streaming
          // Just continue accumulating more chunks
        }
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchDiffs = async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sample-diffs?page=${page}&per_page=10`
      );
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.details || errorMsg;
        } catch {
          // Ignore if response body is not JSON
          console.warn("Failed to parse error response as JSON");
        }
        throw new Error(errorMsg);
      }
      const data: ApiResponse = await response.json();

      setDiffs((prevDiffs) =>
        page === 1 ? data.diffs : [...prevDiffs, ...data.diffs]
      );
      setCurrentPage(data.currentPage);
      setNextPage(data.nextPage);
      if (!initialFetchDone) setInitialFetchDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchClick = () => {
    setDiffs([]); // Clear existing diffs when fetching the first page again
    fetchDiffs(1);
  };

  const handleLoadMoreClick = () => {
    if (nextPage) {
      fetchDiffs(nextPage);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 sm:p-24">
      <h1 className="text-4xl font-bold mb-12">Diff Digest ✍️</h1>

      <div className="w-full max-w-4xl">
        {/* Controls Section */}
        <div className="mb-8 flex space-x-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={handleFetchClick}
            disabled={isLoading}
          >
            {isLoading && currentPage === 1
              ? "Fetching..."
              : "Fetch Latest Diffs"}
          </button>
        </div>

        {/* Results Section */}
        <div className="border border-gray-300 dark:border-gray-700 rounded-lg p-6 min-h-[300px] bg-gray-50 dark:bg-gray-800">
          <h2 className="text-2xl font-semibold mb-4">Merged Pull Requests</h2>

          {error && (
            <div className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded mb-4">
              Error: {error}
            </div>
          )}

          {!initialFetchDone && !isLoading && (
            <p className="text-gray-600 dark:text-gray-400">
              Click the button above to fetch the latest merged pull requests
              from the repository.
            </p>
          )}

          {initialFetchDone && diffs.length === 0 && !isLoading && !error && (
            <p className="text-gray-600 dark:text-gray-400">
              No merged pull requests found or fetched.
            </p>
          )}

          {diffs.length > 0 && (
            <ul className="space-y-3 list-disc list-inside">
              {diffs.map((item) => (
                <li key={item.id} className="text-gray-800 dark:text-gray-200">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    PR #{item.id}:
                  </a>
                  <span className="ml-2">{item.description}</span>
                  {/* We won't display the full diff here, just the description */}

                  <button
                    onClick={() => generateNotes(item)}
                    className="mx-1 px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    disabled={isGenerating && selectedDiff?.id === item.id}
                  >
                    {isGenerating && selectedDiff?.id === item.id
                      ? "Generating..."
                      : selectedDiff?.id === item.id && devNotes
                      ? "Regenerate Notes"
                      : "Generate Notes"}
                  </button>

                  {/*Notes panel only shown for selected PR */}
                  {selectedDiff?.id === item.id && (
                    <div className="border-t pt-3 mt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Developer Notes*/}
                        <div className="border border-blue-200 dark:border-blue-800 rounded p-3 bg-blue-50 dark:bg-blue-900/20">
                          <h4 className="text-md font-medium mb-2 ">
                            Developer Notes
                          </h4>
                          <div className="text-sm whitespace-pre-wrap">
                            {devNotes || (isGenerating ? "generating..." : "")}
                          </div>
                        </div>

                        {/* Marketing Notes*/}
                        <div className="border border-blue-200 dark:border-blue-800 rounded p-3 bg-blue-50 dark:bg-blue-900/20">
                          <h4 className="text-md font-medium mb-2">
                            Marketing Notes
                          </h4>
                          <div className="text-sm whitespace-pre-wrap">
                            {marketingNotes ||
                              (isGenerating ? "generating..." : "")}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isLoading && currentPage > 1 && (
            <p className="text-gray-600 dark:text-gray-400 mt-4">
              Loading more...
            </p>
          )}

          {nextPage && !isLoading && (
            <div className="mt-6">
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                onClick={handleLoadMoreClick}
                disabled={isLoading}
              >
                Load More (Page {nextPage})
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
