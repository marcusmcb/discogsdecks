import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";

interface Location {
  id: string;
  name: string;
  color: string | null;
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLocation?: Location | null;
}

const PREDEFINED_COLORS = [
  "#ef4444", // red-500
  "#f97316", // orange-500
  "#f59e0b", // amber-500
  "#eab308", // yellow-500
  "#84cc16", // lime-500
  "#22c55e", // green-500
  "#10b981", // emerald-500
  "#14b8a6", // teal-500
  "#06b6d4", // cyan-500
  "#0ea5e9", // sky-500
  "#3b82f6", // blue-500
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#d946ef", // fuchsia-500
  "#ec4899", // pink-500
];

export function LocationModal({ isOpen, onClose, editingLocation }: LocationModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get existing locations to check for color conflicts
  const { data: locationsData } = useQuery<{ locations: Location[] }>({
    queryKey: ['/api/locations'],
  });

  const existingLocations = locationsData?.locations || [];

  useEffect(() => {
    if (editingLocation) {
      setName(editingLocation.name);
      setSelectedColor(editingLocation.color);
    } else {
      setName("");
      setSelectedColor(null);
    }
  }, [editingLocation, isOpen]);

  const createLocationMutation = useMutation({
    mutationFn: async (data: { name: string; color: string | null }) => {
      return apiRequest('POST', '/api/locations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      toast({
        title: "Location Created",
        description: `Location "${name}" has been created successfully.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Location",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (data: { name: string; color: string | null }) => {
      return apiRequest('PATCH', `/api/locations/${editingLocation!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      toast({
        title: "Location Updated",
        description: `Location "${name}" has been updated successfully.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Location",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setName("");
    setSelectedColor(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a location name.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name: name.trim(),
      color: selectedColor,
    };

    if (editingLocation) {
      updateLocationMutation.mutate(data);
    } else {
      createLocationMutation.mutate(data);
    }
  };

  const isColorUsed = (color: string) => {
    return existingLocations.some(
      location => location.color === color && location.id !== editingLocation?.id
    );
  };

  const isPending = createLocationMutation.isPending || updateLocationMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="location-modal">
        <DialogHeader>
          <DialogTitle data-testid="modal-title">
            {editingLocation ? 'Edit Location' : 'Create New Location'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="location-name" data-testid="label-name">
              Location Name
            </Label>
            <Input
              id="location-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Living Room, Studio A, Bedroom"
              data-testid="input-location-name"
              disabled={isPending}
            />
          </div>

          <div className="space-y-3">
            <Label data-testid="label-color">Color (Optional)</Label>
            <div className="grid grid-cols-8 gap-2">
              {/* No color option */}
              <button
                type="button"
                onClick={() => setSelectedColor(null)}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  selectedColor === null 
                    ? 'border-primary bg-muted' 
                    : 'border-border hover:border-muted-foreground'
                }`}
                data-testid="color-none"
                disabled={isPending}
              >
                {selectedColor === null && <X className="w-4 h-4" />}
              </button>
              
              {/* Color options */}
              {PREDEFINED_COLORS.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  disabled={isColorUsed(color) || isPending}
                  className={`w-8 h-8 rounded-full border-2 relative ${
                    selectedColor === color 
                      ? 'border-primary ring-2 ring-primary ring-offset-2' 
                      : isColorUsed(color)
                      ? 'border-border opacity-30 cursor-not-allowed'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`color-${index}`}
                  title={isColorUsed(color) ? 'Color already in use' : ''}
                >
                  {selectedColor === color && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
            {selectedColor && isColorUsed(selectedColor) && (
              <p className="text-sm text-destructive" data-testid="error-color-used">
                This color is already assigned to another location.
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name.trim()}
              data-testid="button-save"
            >
              {isPending ? 'Saving...' : editingLocation ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}