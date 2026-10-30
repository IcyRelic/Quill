import Link from "next/link";
import SearchBox from "@/components/SearchBox";

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>No page here</h1>
      <p>The page may have moved or been renamed. Search for what you were looking for, or go back to the start.</p>
      <div className="hero-actions">
        <SearchBox />
        <Link className="button" href="/">
          Back to the docs
        </Link>
      </div>
    </div>
  );
}
