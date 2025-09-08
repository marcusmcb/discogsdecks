import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Clock, Database } from "lucide-react";

interface ImportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isUpdate?: boolean;
}

export function ImportConfirmationModal({ isOpen, onClose, onConfirm, isUpdate = false }: ImportConfirmationModalProps) {
  const actionText = isUpdate ? "update" : "import";
  const actionTitle = isUpdate ? "Update Collection" : "Import Collection";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="import-confirmation-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {actionTitle}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-medium text-amber-800 dark:text-amber-200">This will take some time</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Due to Discogs API rate limiting (1 request per second), {actionText}ing your collection 
                may take several minutes depending on its size. Please be patient and don't close this window.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-medium text-blue-800 dark:text-blue-200">What happens next</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {isUpdate 
                  ? "We'll check for new releases and update your existing collection with any changes from Discogs."
                  : "We'll fetch all releases from your Discogs collection and add them to your DJ Library."
                }
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {isUpdate 
              ? "Are you ready to update your collection from Discogs?"
              : "Are you ready to import your collection from Discogs?"
            }
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-import"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            data-testid="button-confirm-import"
          >
            Yes, {actionText} my collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}