import { Headphones, Disc, Download, Search, Plus, FolderOpen, Folder, Edit2, Trash2 } from "lucide-react";
import { LocationManager } from "./location-manager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Crate {
  id: string;
  name: string;
  createdAt: string;
}

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
  selectedCrate: string | null;
  onSelectCrate: (crateId: string | null) => void;
  onTrackDrop: (crateId: string, trackIds: string[]) => void;
}

export function Sidebar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  stats,
  onImport,
  connected,
  selectedCrate,
  onSelectCrate,
  onTrackDrop,
}: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newCrateName, setNewCrateName] = useState('');
  const [editingCrate, setEditingCrate] = useState<string | null>(null);
  const [editCrateName, setEditCrateName] = useState('');
  const [deleteConfirmCrate, setDeleteConfirmCrate] = useState<{id: string, name: string} | null>(null);
  
  const queryClient = useQueryClient();
  
  // Fetch crates
  const { data: cratesData } = useQuery<{ crates: Crate[] }>({
    queryKey: ['/api/crates'],
  });
  
  // Fetch genres
  const { data: genresData } = useQuery<{ genres: string[] }>({
    queryKey: ['/api/genres'],
  });
  
  // Create crate mutation
  const createCrateMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest('POST', '/api/crates', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crates'] });
      setIsCreating(false);
      setNewCrateName('');
    },
  });
  
  // Update crate mutation
  const updateCrateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest('PATCH', `/api/crates/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crates'] });
      setEditingCrate(null);
      setEditCrateName('');
    },
  });
  
  // Delete crate mutation
  const deleteCrateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/crates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crates'] });
      if (selectedCrate && selectedCrate !== 'main') {
        onSelectCrate('main');
      }
    },
  });
  
  const handleCreateCrate = () => {
    if (newCrateName.trim()) {
      createCrateMutation.mutate(newCrateName.trim());
    }
  };
  
  const handleUpdateCrate = (id: string) => {
    if (editCrateName.trim()) {
      updateCrateMutation.mutate({ id, name: editCrateName.trim() });
    }
  };
  
  const startEditing = (crate: Crate) => {
    setEditingCrate(crate.id);
    setEditCrateName(crate.name);
  };
  
  const crates = cratesData?.crates || [];
  const genres = genresData?.genres || [];
  return (
    <div className="w-80 min-w-80 max-w-80 bg-card border-r border-border flex flex-col overflow-hidden" data-testid="sidebar-container">
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
        
        {/* Crates */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Crates</h3>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsCreating(true)}
              data-testid="button-create-crate"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            {/* Main/All Tracks Crate */}
            <div
              className={cn(
                "flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors min-w-0",
                selectedCrate === 'main' || selectedCrate === null
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
              onClick={() => onSelectCrate('main')}
              data-testid="crate-main"
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium flex-1 truncate">All Tracks</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {stats?.totalTracks || 0}
              </span>
            </div>
            
            {/* User Crates */}
            {crates.map((crate) => (
              <div
                key={crate.id}
                className={cn(
                  "flex items-center space-x-2 p-2 rounded transition-colors group min-w-0",
                  selectedCrate === crate.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent cursor-pointer"
                )}
                onClick={() => selectedCrate !== crate.id && onSelectCrate(crate.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const trackIds = JSON.parse(e.dataTransfer.getData('application/json'));
                  onTrackDrop(crate.id, trackIds);
                }}
                data-testid={`crate-${crate.id}`}
              >
                <Folder className="h-4 w-4 flex-shrink-0" />
                {editingCrate === crate.id ? (
                  <Input
                    value={editCrateName}
                    onChange={(e) => setEditCrateName(e.target.value)}
                    onBlur={() => handleUpdateCrate(crate.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateCrate(crate.id);
                      if (e.key === 'Escape') {
                        setEditingCrate(null);
                        setEditCrateName('');
                      }
                    }}
                    className="text-sm h-6 border-0 shadow-none focus:ring-1 focus:ring-primary p-1 flex-1 min-w-0"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm flex-1 truncate min-w-0">{crate.name}</span>
                )}
                <div className="opacity-0 group-hover:opacity-100 flex space-x-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(crate);
                    }}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmCrate({ id: crate.id, name: crate.name });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Create New Crate */}
            {isCreating && (
              <div className="flex items-center space-x-2 p-2 rounded bg-accent">
                <Folder className="h-4 w-4" />
                <Input
                  value={newCrateName}
                  onChange={(e) => setNewCrateName(e.target.value)}
                  onBlur={() => {
                    if (newCrateName.trim()) {
                      handleCreateCrate();
                    } else {
                      setIsCreating(false);
                      setNewCrateName('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCrate();
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewCrateName('');
                    }
                  }}
                  placeholder="New Crate"
                  className="text-sm h-6 border-0 shadow-none focus:ring-1 focus:ring-primary p-1"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Locations */}
        <LocationManager />
        
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
                {genres.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
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
      
      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteConfirmCrate} onOpenChange={(open) => !open && setDeleteConfirmCrate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Crate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the crate "{deleteConfirmCrate?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmCrate) {
                  deleteCrateMutation.mutate(deleteConfirmCrate.id);
                  setDeleteConfirmCrate(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
