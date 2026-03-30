import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZES = [5, 10, 20] as const;

interface ActivityPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

export function ActivityPagination({ currentPage, totalPages, onPageChange, pageSize, onPageSizeChange }: ActivityPaginationProps) {
  if (totalPages <= 1 && pageSize === PAGE_SIZES[0]) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const currentSizeIndex = PAGE_SIZES.indexOf(pageSize as typeof PAGE_SIZES[number]);

  return (
    <div className="pagination-strip">
      <div className="flex items-center gap-1.5 p-1.5 relative z-10">
        {/* Left arrow */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="page-arrow"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`page-button ${page === currentPage ? 'page-button-active' : ''}`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Digital readout */}
        <div className="console-inset px-3 py-1.5 mx-1">
          <span className="font-display text-[10px] text-foreground uppercase tracking-wider">
            Page {String(currentPage).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
          </span>
        </div>

        {/* Right arrow */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="page-arrow"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Rotary knob page-size selector */}
        <div className="hidden sm:flex items-center gap-1.5 pl-1.5 ml-1 border-l border-border/30">
          <div className="rotary-knob-housing">
            <div className="rotary-knob-label">PER PAGE</div>
            <div className="flex items-center gap-0.5">
              {PAGE_SIZES.map((size, i) => (
                <button
                  key={size}
                  onClick={() => onPageSizeChange(size)}
                  className={`rotary-detent ${i === currentSizeIndex ? 'rotary-detent-active' : ''}`}
                  title={`${size} per page`}
                >
                  {size}
                </button>
              ))}
            </div>
            {/* Knob indicator dial */}
            <div className="rotary-dial" style={{
              transform: `rotate(${(currentSizeIndex - 1) * 45}deg)`,
            }}>
              <div className="rotary-dial-tick" />
            </div>
          </div>
        </div>

        {/* Decorative knobs */}
        <div className="hidden sm:flex items-center gap-1.5 pl-1">
          <div className="w-3 h-3 rounded-full" style={{
            background: 'radial-gradient(circle at 35% 35%, hsl(216, 8%, 30%), hsl(216, 12%, 16%))',
            boxShadow: 'inset 0 1px 2px hsl(216, 10%, 36% / 0.4), inset 0 -1px 2px hsl(216, 18%, 5% / 0.6), 0 1px 3px hsl(216, 18%, 3% / 0.4)',
          }} />
          <div className="w-2 h-2 rounded-full" style={{
            background: 'radial-gradient(circle at 40% 35%, hsl(216, 8%, 28%), hsl(216, 12%, 14%))',
            boxShadow: 'inset 0 1px 1px hsl(216, 10%, 32% / 0.3), 0 1px 2px hsl(216, 18%, 3% / 0.3)',
          }} />
        </div>
      </div>
    </div>
  );
}
