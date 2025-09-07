import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TrackTable } from "@/components/track-table";
import { AuthModal } from "@/components/auth-modal";
import { ImportModal } from "@/components/import-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCrate, setSelectedCrate] = useState<string | null>('main');
  const [filters, setFilters] = useState({
    yearFrom: "",
    yearTo: "",
    genre: "",
    format: "",
    sortBy: "artist" as const,
    sortOrder: "asc" as const,
  });
  const [currentPage, setCurrentPage] = useState(1);
  
  const queryClient = useQueryClient();

  const { data: stats } = useQuery<{
    totalTracks: number;
    totalReleases: number;
    lastUpdated: string | null;
    connected: boolean;
  }>({
    queryKey: ["/api/stats"],
  });

  const handleImport = () => {
    if (!stats?.connected) {
      setShowAuthModal(true);
    } else {
      setShowImportModal(true);
    }
  };
  
  // Mutation for adding tracks to crates
  const addTrackToCrateMutation = useMutation({
    mutationFn: async ({ crateId, trackId }: { crateId: string; trackId: string }) => {
      return apiRequest('POST', `/api/crates/${crateId}/tracks`, { trackId });
    },
    onSuccess: (_, { crateId }) => {
      // Invalidate crates list and specific crate tracks
      queryClient.invalidateQueries({ queryKey: ['/api/crates'] });
      queryClient.invalidateQueries({ queryKey: [`/api/crates/${crateId}/tracks`] });
    },
  });
  
  const handleTrackDrop = (crateId: string, trackIds: string[]) => {
    trackIds.forEach(trackId => {
      addTrackToCrateMutation.mutate({ crateId, trackId });
    });
  };

  return (
    <div className="flex h-screen bg-background text-foreground">
      <div className="flex-shrink-0">
        <Sidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          stats={stats}
          onImport={handleImport}
          connected={stats?.connected || false}
          selectedCrate={selectedCrate}
          onSelectCrate={setSelectedCrate}
          onTrackDrop={handleTrackDrop}
          data-testid="sidebar"
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <TrackTable
          searchQuery={searchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          selectedTrack={selectedTrack}
          onSelectTrack={setSelectedTrack}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          selectedCrate={selectedCrate}
          data-testid="track-table"
        />
      </div>

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          data-testid="auth-modal"
        />
      )}

      {showImportModal && (
        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          data-testid="import-modal"
        />
      )}
    </div>
  );
}
