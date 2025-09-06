import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { List, Grid3X3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

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
          <div className="h-full flex flex-col">
            {/* Header Row - Controls column widths */}
            <div className="bg-secondary border-b border-border">
              <PanelGroup direction="horizontal" id="table-columns">
                <Panel defaultSize={4} minSize={3} maxSize={6} id="col-position">
                  <div className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">
                    #
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={19} minSize={10} id="col-artist">
                  <div className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                    Artist
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={24} minSize={15} id="col-title">
                  <div className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                    Track Title
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={19} minSize={10} id="col-release">
                  <div className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                    Release
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={8} minSize={6} maxSize={12} id="col-year">
                  <div className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Year
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={11} minSize={8} maxSize={16} id="col-genre">
                  <div className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Genre
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={8} minSize={6} maxSize={12} id="col-format">
                  <div className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">
                    Format
                  </div>
                </Panel>
                <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
                <Panel defaultSize={7} minSize={6} maxSize={12} id="col-duration">
                  <div className="px-3 py-3 text-left text-sm font-medium text-muted-foreground">
                    Duration
                  </div>
                </Panel>
              </PanelGroup>
            </div>
            
            {/* Scrollable Content - Each row follows the same column structure */}
            <div className="flex-1 overflow-auto">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`border-b border-border cursor-pointer ${
                    selectedTrack === track.id ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => onSelectTrack(track.id)}
                  data-testid={`row-track-${track.id}`}
                >
                  <PanelGroup direction="horizontal" id={`row-${track.id}`}>
                    <Panel defaultSize={4} minSize={3} maxSize={6}>
                      <div className="px-3 py-3 text-sm text-muted-foreground" data-testid={`text-position-${track.id}`}>
                        {String(index + 1 + (currentPage - 1) * 50).padStart(3, '0')}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={19} minSize={10}>
                      <div className="px-6 py-3 text-sm font-medium truncate" data-testid={`text-artist-${track.id}`} title={track.artist}>
                        {track.artist}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={24} minSize={15}>
                      <div className="px-6 py-3 text-sm truncate" data-testid={`text-title-${track.id}`} title={track.title}>
                        {track.title}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={19} minSize={10}>
                      <div className="px-6 py-3 text-sm text-muted-foreground truncate" data-testid={`text-release-${track.id}`} title={track.release.title}>
                        {track.release.title}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={8} minSize={6} maxSize={12}>
                      <div className="px-4 py-3 text-sm text-muted-foreground" data-testid={`text-year-${track.id}`}>
                        {track.release.year || '—'}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={11} minSize={8} maxSize={16}>
                      <div className="px-4 py-3 text-sm text-muted-foreground truncate" data-testid={`text-genre-${track.id}`} title={track.release.genre || '—'}>
                        {track.release.genre || '—'}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={8} minSize={6} maxSize={12}>
                      <div className="px-3 py-3 text-sm text-muted-foreground truncate" data-testid={`text-format-${track.id}`} title={track.release.format || '—'}>
                        {track.release.format || '—'}
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-transparent pointer-events-none" />
                    <Panel defaultSize={7} minSize={6} maxSize={12}>
                      <div className="px-3 py-3 text-sm text-muted-foreground" data-testid={`text-duration-${track.id}`}>
                        {track.duration || '—'}
                      </div>
                    </Panel>
                  </PanelGroup>
                </div>
              ))}
            </div>
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
