import { Headphones, Disc, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: {
    yearFrom: string;
    yearTo: string;
    genre: string;
    format: string;
    sortBy: string;
    sortOrder: string;
  };
  onFiltersChange: (filters: any) => void;
  stats?: {
    totalTracks: number;
    totalReleases: number;
    lastUpdated: string | null;
    connected: boolean;
  };
  onImport: () => void;
  connected: boolean;
}

export function Sidebar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  stats,
  onImport,
  connected,
}: SidebarProps) {
  return (
    <div className="w-80 bg-card border-r border-border flex flex-col" data-testid="sidebar-container">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3 mb-6">
          <Headphones className="text-primary text-2xl h-8 w-8" />
          <h1 className="text-xl font-bold" data-testid="app-title">DJ Library</h1>
        </div>
        
        {/* Discogs Connection Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
            <div className="flex items-center space-x-2">
              <Disc className="text-primary h-4 w-4" />
              <span className="text-sm font-medium">Discogs</span>
            </div>
            <span className="text-xs text-muted-foreground" data-testid="connection-status">
              {connected ? "Connected" : "Not Connected"}
            </span>
          </div>
          
          <Button 
            className="w-full" 
            onClick={onImport}
            data-testid="button-import"
          >
            <Download className="mr-2 h-4 w-4" />
            Import Collection
          </Button>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="flex-1 p-6 space-y-6">
        {/* Search Box */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Search</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              type="text" 
              placeholder="Search tracks, artists..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>
        
        {/* Filter Panel */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Filters</h3>
          
          {/* Year Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Release Year</Label>
            <div className="flex space-x-2">
              <Input 
                type="number" 
                placeholder="From" 
                className="flex-1"
                value={filters.yearFrom}
                onChange={(e) => onFiltersChange({ ...filters, yearFrom: e.target.value })}
                data-testid="input-year-from"
              />
              <Input 
                type="number" 
                placeholder="To" 
                className="flex-1"
                value={filters.yearTo}
                onChange={(e) => onFiltersChange({ ...filters, yearTo: e.target.value })}
                data-testid="input-year-to"
              />
            </div>
          </div>
          
          {/* Genre Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Genre</Label>
            <Select value={filters.genre} onValueChange={(value) => onFiltersChange({ ...filters, genre: value === "all" ? "" : value })}>
              <SelectTrigger data-testid="select-genre">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                <SelectItem value="Electronic">Electronic</SelectItem>
                <SelectItem value="House">House</SelectItem>
                <SelectItem value="Techno">Techno</SelectItem>
                <SelectItem value="Drum & Bass">Drum & Bass</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Format Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Format</Label>
            <Select value={filters.format} onValueChange={(value) => onFiltersChange({ ...filters, format: value === "all" ? "" : value })}>
              <SelectTrigger data-testid="select-format">
                <SelectValue placeholder="All Formats" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="Vinyl">Vinyl</SelectItem>
                <SelectItem value="CD">CD</SelectItem>
                <SelectItem value="Digital">Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Library Stats */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Library Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Tracks:</span>
              <span className="font-medium" data-testid="text-total-tracks">
                {stats?.totalTracks?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Releases:</span>
              <span className="font-medium" data-testid="text-total-releases">
                {stats?.totalReleases?.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated:</span>
              <span className="font-medium text-xs" data-testid="text-last-updated">
                {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
