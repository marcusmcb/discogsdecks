import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TrackTable } from "@/components/track-table";
import { AuthModal } from "@/components/auth-modal";
import { ImportModal } from "@/components/import-modal";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    yearFrom: "",
    yearTo: "",
    genre: "",
    format: "",
    sortBy: "artist" as const,
    sortOrder: "asc" as const,
  });
  const [currentPage, setCurrentPage] = useState(1);

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

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        stats={stats}
        onImport={handleImport}
        connected={stats?.connected || false}
        data-testid="sidebar"
      />
      
      <div className="flex-1">
        <TrackTable
          searchQuery={searchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          selectedTrack={selectedTrack}
          onSelectTrack={setSelectedTrack}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
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
