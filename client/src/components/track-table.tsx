import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { List, Grid3X3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Track {
  id: string;
  title: string;
  artist: string;
  position?: string;
  duration?: string;
  release: {
    title: string;
    year?: number;
    genre?: string;
    format?: string;
  };
}

interface TrackTableProps {
  searchQuery: string;
  filters: {
    yearFrom: string;
    yearTo: string;
    genre: string;
    format: string;
    sortBy: string;
    sortOrder: string;
  };
  onFiltersChange: (filters: any) => void;
  selectedTrack: string | null;
  onSelectTrack: (trackId: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function TrackTable({
  searchQuery,
  filters,
  onFiltersChange,
  selectedTrack,
  onSelectTrack,
  currentPage,
  onPageChange,
}: TrackTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const { data: tracksData, isLoading } = useQuery({
    queryKey: [
      '/api/tracks',
      searchQuery,
      filters.yearFrom,
      filters.yearTo,
      filters.genre,
      filters.format,
      filters.sortBy,
      filters.sortOrder,
      currentPage,
    ],
    queryFn: ({ queryKey }) => {
      const [, search, yearFrom, yearTo, genre, format, sortBy, sortOrder, page] = queryKey;
      const params = new URLSearchParams({
        ...(search && { search: search as string }),
        ...(yearFrom && { yearFrom: yearFrom as string }),
        ...(yearTo && { yearTo: yearTo as string }),
        ...(genre && { genre: genre as string }),
        ...(format && { format: format as string }),
        sortBy: sortBy as string,
        sortOrder: sortOrder as string,
        page: page?.toString() || '1',
        limit: '50',
      });
      return fetch(`/api/tracks?${params}`).then(res => res.json());
    },
  });

  const tracks: Track[] = tracksData?.tracks || [];
  const total = tracksData?.total || 0;
  const totalPages = tracksData?.totalPages || 1;

  return (
    <div className="flex-1 flex flex-col" data-testid="track-table-container">
      {/* Toolbar */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold" data-testid="text-library-title">Track Library</h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span data-testid="text-track-count">{total.toLocaleString()}</span>
              <span>tracks</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* View Toggle */}
            <div className="flex bg-secondary rounded-md p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 py-1 ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setViewMode('table')}
                data-testid="button-table-view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 py-1 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : ''}`}
                onClick={() => setViewMode('grid')}
                data-testid="button-grid-view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Sort Options */}
            <Select value={filters.sortBy} onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value })}>
              <SelectTrigger className="w-48" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="artist">Sort by Artist</SelectItem>
                <SelectItem value="title">Sort by Title</SelectItem>
                <SelectItem value="year">Sort by Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Track Table */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2">Loading tracks...</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <p className="text-lg text-muted-foreground">No tracks found</p>
              <p className="text-sm text-muted-foreground">
                Try importing your collection or adjusting your search filters
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto scrollbar-thin">
            <table className="w-full">
              <thead className="bg-secondary sticky top-0 z-10">
                <tr className="text-left text-sm font-medium text-muted-foreground">
                  <th className="px-6 py-3 w-8">#</th>
                  <th className="px-6 py-3">Artist</th>
                  <th className="px-6 py-3">Track Title</th>
                  <th className="px-6 py-3">Release</th>
                  <th className="px-6 py-3 w-20">Year</th>
                  <th className="px-6 py-3 w-24">Genre</th>
                  <th className="px-6 py-3 w-20">Format</th>
                  <th className="px-6 py-3 w-16">Duration</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, index) => (
                  <tr
                    key={track.id}
                    className={`table-row border-b border-border text-sm cursor-pointer ${
                      selectedTrack === track.id ? 'selected' : ''
                    }`}
                    onClick={() => onSelectTrack(track.id)}
                    data-testid={`row-track-${track.id}`}
                  >
                    <td className="px-6 py-3 text-muted-foreground" data-testid={`text-position-${track.id}`}>
                      {String(index + 1 + (currentPage - 1) * 50).padStart(3, '0')}
                    </td>
                    <td className="px-6 py-3 font-medium" data-testid={`text-artist-${track.id}`}>
                      {track.artist}
                    </td>
                    <td className="px-6 py-3" data-testid={`text-title-${track.id}`}>
                      {track.title}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground" data-testid={`text-release-${track.id}`}>
                      {track.release.title}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground" data-testid={`text-year-${track.id}`}>
                      {track.release.year || '—'}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground" data-testid={`text-genre-${track.id}`}>
                      {track.release.genre || '—'}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground" data-testid={`text-format-${track.id}`}>
                      {track.release.format || '—'}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground" data-testid={`text-duration-${track.id}`}>
                      {track.duration || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="bg-card border-t border-border px-6 py-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span data-testid="text-pagination-info">
              Showing {Math.min((currentPage - 1) * 50 + 1, total)}-{Math.min(currentPage * 50, total)} of {total.toLocaleString()} tracks
            </span>
          </div>
          
          {/* Pagination */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              data-testid="button-previous-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3" data-testid="text-page-info">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
