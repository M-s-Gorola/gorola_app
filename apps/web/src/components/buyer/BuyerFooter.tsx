import type { ReactElement } from "react";
import { Link } from "react-router-dom";

export function BuyerFooter(): ReactElement {
  return (
    <footer className="mt-auto border-t border-gorola-pine-dark bg-gorola-pine px-4 py-6 text-gorola-fog" role="contentinfo">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between text-sm">
        <p>GoRola - Mussoorie, delivered.</p>
        <div className="flex items-center gap-4">
          <Link to="/about" className="hover:underline">
            About
          </Link>
          <Link to="/support" className="hover:underline">
            Support
          </Link>
        </div>
      </div>
    </footer>
  );
}
