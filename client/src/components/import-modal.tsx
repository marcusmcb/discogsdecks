import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/import'),
    onSuccess: (response) => {
      const data = response.json();
      toast({
        title: "Import Complete",
        description: `Successfully imported your collection!`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tracks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      onClose();
    },
    onError: (error) => {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: "Failed to import collection. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (isOpen && !importMutation.isPending) {
      // Start import immediately when modal opens
      setProgress(0);
      setStatus("Starting import...");
      importMutation.mutate();
    }
  }, [isOpen]);

  useEffect(() => {
    if (importMutation.isPending) {
      // Simulate progress updates
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 10, 95);
          
          if (newProgress < 30) {
            setStatus("Fetching your collection from Discogs...");
          } else if (newProgress < 60) {
            setStatus("Processing releases and extracting tracks...");
          } else if (newProgress < 90) {
            setStatus("Saving tracks to database...");
          } else {
            setStatus("Finalizing import...");
          }
          
          return newProgress;
        });
      }, 500);

      return () => clearInterval(interval);
    } else {
      setProgress(100);
      setStatus("Import completed!");
    }
  }, [importMutation.isPending]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="import-modal-content">
        <DialogHeader>
          <DialogTitle className="text-center">Importing Collection</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-6 p-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          
          <p className="text-muted-foreground">
            Fetching your releases from Discogs and extracting track information...
          </p>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span data-testid="text-import-progress">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" data-testid="progress-import" />
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <p data-testid="text-import-status">{status}</p>
          </div>

          {!importMutation.isPending && progress === 100 && (
            <Button 
              onClick={onClose}
              className="w-full"
              data-testid="button-close-import"
            >
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
