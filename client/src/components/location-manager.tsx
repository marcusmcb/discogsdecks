import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationModal } from "./location-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
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

interface Location {
  id: string;
  name: string;
  color: string | null;
}

export function LocationManager() {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deleteConfirmLocation, setDeleteConfirmLocation] = useState<Location | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: locationsData } = useQuery<{ locations: Location[] }>({
    queryKey: ['/api/locations'],
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: string) => {
      return apiRequest('DELETE', `/api/locations/${locationId}`);
    },
    onSuccess: (_, locationId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tracks'] });
      toast({
        title: "Location Deleted",
        description: "Location has been deleted successfully.",
      });
      setDeleteConfirmLocation(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Location",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const locations = locationsData?.locations || [];

  const handleCreateLocation = () => {
    setEditingLocation(null);
    setShowLocationModal(true);
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setShowLocationModal(true);
  };

  const handleDeleteLocation = (location: Location) => {
    if (location.name === "Main") {
      toast({
        title: "Cannot Delete Main Location",
        description: "The Main location cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    setDeleteConfirmLocation(location);
  };

  const confirmDelete = () => {
    if (deleteConfirmLocation) {
      deleteLocationMutation.mutate(deleteConfirmLocation.id);
    }
  };

  return (
    <div className="space-y-4" data-testid="location-manager">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Locations
        </h3>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={handleCreateLocation}
          data-testid="button-create-location"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="space-y-1">
        {locations.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">
            No locations created yet.
          </div>
        ) : (
          locations.map((location) => (
            <div
              key={location.id}
              className="flex items-center space-x-2 p-2 rounded transition-colors group hover:bg-accent min-w-0"
              data-testid={`location-${location.id}`}
            >
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span 
                className="text-sm flex-1 truncate min-w-0"
                style={{ color: location.color || 'inherit' }}
                data-testid={`location-name-${location.id}`}
              >
                {location.name}
              </span>
              
              {/* Show actions on hover for all locations except when they're being deleted */}
              <div className="opacity-0 group-hover:opacity-100 flex space-x-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleEditLocation(location)}
                  data-testid={`button-edit-location-${location.id}`}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
                
                {/* Only show delete button if not Main location */}
                {location.name !== "Main" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => handleDeleteLocation(location)}
                    data-testid={`button-delete-location-${location.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Location Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        editingLocation={editingLocation}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={!!deleteConfirmLocation} 
        onOpenChange={() => setDeleteConfirmLocation(null)}
      >
        <AlertDialogContent data-testid="delete-location-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the location "{deleteConfirmLocation?.name}"?
              All tracks currently assigned to this location will be moved to no location.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              data-testid="button-confirm-delete"
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