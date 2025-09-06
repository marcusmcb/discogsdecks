import { useState } from "react";
import { Disc, Link, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/auth/discogs');
      const data = await response.json();
      
      if (data.authUrl) {
        // Redirect to Discogs OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get auth URL');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Discogs. Please try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="auth-modal-content">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center space-x-2">
            <Disc className="text-primary h-8 w-8" />
            <span>Connect to Discogs</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4 p-4">
          <p className="text-muted-foreground">
            Connect your Discogs account to import your collection and start building your DJ library.
          </p>
          
          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={handleConnect}
              disabled={isConnecting}
              data-testid="button-connect-discogs"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Connect Discogs Account
                </>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={onClose}
              data-testid="button-cancel-auth"
            >
              Cancel
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>We'll redirect you to Discogs to authorize this application. Your credentials are never stored locally.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
