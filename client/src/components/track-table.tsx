import { useState, useCallback } from "react";
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

interface ColumnConfig {
  id: string;
  label: string;
  size: number;
  minSize: number;
  maxSize?: number;
  getValue: (track: Track, index: number, currentPage: number) => string;
  className?: string;
  padding: string;
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
  
  const defaultColumns: ColumnConfig[] = [
    {
      id: 'position',
      label: '#',
      size: 4,
      minSize: 3,
      maxSize: 6,
      getValue: (_, index, currentPage) => String(index + 1 + (currentPage - 1) * 50).padStart(3, '0'),
      className: 'text-muted-foreground',
      padding: 'px-3 py-3'
    },
    {
      id: 'artist',
      label: 'Artist',
      size: 19,
      minSize: 10,
      getValue: (track) => track.artist,
      className: 'font-medium truncate',
      padding: 'px-6 py-3'
    },
    {
      id: 'title',
      label: 'Track Title',
      size: 24,
      minSize: 15,
      getValue: (track) => track.title,
      className: 'truncate',
      padding: 'px-6 py-3'
    },
    {
      id: 'release',
      label: 'Release',
      size: 19,
      minSize: 10,
      getValue: (track) => track.release.title,
      className: 'text-muted-foreground truncate',
      padding: 'px-6 py-3'
    },
    {
      id: 'year',
      label: 'Year',
      size: 8,
      minSize: 6,
      maxSize: 12,
      getValue: (track) => track.release.year?.toString() || '—',
      className: 'text-muted-foreground',
      padding: 'px-4 py-3'
    },
    {
      id: 'genre',
      label: 'Genre',
      size: 11,
      minSize: 8,
      maxSize: 16,
      getValue: (track) => track.release.genre || '—',
      className: 'text-muted-foreground truncate',
      padding: 'px-4 py-3'
    },
    {
      id: 'format',
      label: 'Format',
      size: 8,
      minSize: 6,
      maxSize: 12,
      getValue: (track) => track.release.format || '—',
      className: 'text-muted-foreground truncate',
      padding: 'px-3 py-3'
    },
    {
      id: 'duration',
      label: 'Duration',
      size: 7,
      minSize: 6,
      maxSize: 12,
      getValue: (track) => track.duration || '—',
      className: 'text-muted-foreground',
      padding: 'px-3 py-3'
    }
  ];

  const [columns, setColumns] = useState<ColumnConfig[]>(defaultColumns);
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);

  const handleColumnResize = useCallback((sizes: number[]) => {
    setColumns(prev => prev.map((col, index) => ({ ...col, size: sizes[index] })));
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, columnIndex: number) => {
    setDraggedColumn(columnIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnIndex);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedColumn === null || draggedColumn === dropIndex) return;

    setColumns(prev => {
      const newColumns = [...prev];
      const draggedCol = newColumns[draggedColumn];
      newColumns.splice(draggedColumn, 1);
      newColumns.splice(dropIndex, 0, draggedCol);
      return newColumns;
    });
    
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [draggedColumn]);

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
    <div className="h-full flex flex-col" data-testid="track-table-container">
      {/* Toolbar */}
      <div className="bg-card border-b border-border px-6 py-4 flex-shrink-0">
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
      <div className="flex-1 min-h-0 overflow-hidden">
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
            <div className="bg-secondary border-b border-border flex-shrink-0">
              <PanelGroup direction="horizontal" onLayout={handleColumnResize}>
                {columns.flatMap((column, index) => {
                  const elements = [
                    <Panel 
                      key={`panel-${column.id}`}
                      defaultSize={column.size} 
                      minSize={column.minSize} 
                      maxSize={column.maxSize}
                    >
                      <div 
                        className={`${column.padding} text-left text-sm font-medium text-muted-foreground cursor-move select-none ${
                          draggedColumn === index ? 'opacity-50' : ''
                        } ${
                          dragOverColumn === index ? 'bg-accent' : ''
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        title="Drag to reorder column"
                      >
                        {column.label}
                      </div>
                    </Panel>
                  ];
                  
                  if (index < columns.length - 1) {
                    elements.push(
                      <PanelResizeHandle 
                        key={`handle-${column.id}`}
                        className="w-1 bg-border hover:bg-primary/50 transition-colors" 
                      />
                    );
                  }
                  
                  return elements;
                })}
              </PanelGroup>
            </div>
            
            {/* Scrollable Content - Uses CSS widths based on column sizes */}
            <div className="flex-1 overflow-auto">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`border-b border-border cursor-pointer flex ${
                    selectedTrack === track.id ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => onSelectTrack(track.id)}
                  data-testid={`row-track-${track.id}`}
                >
                  {columns.map((column) => {
                    const value = column.getValue(track, index, currentPage);
                    const testId = `text-${column.id}-${track.id}`;
                    
                    return (
                      <div 
                        key={column.id}
                        className={`text-sm ${column.className || ''} ${column.padding}`} 
                        style={{ width: `${column.size}%` }} 
                        data-testid={testId}
                        title={column.className?.includes('truncate') ? value : undefined}
                      >
                        {value}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="bg-card border-t border-border px-6 py-3 flex-shrink-0">
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
