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
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/auth/discogs/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          token
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsConnecting(false);
        onClose();
        toast({
          title: "Connected Successfully",
          description: "Your Discogs account has been connected!",
        });
        // Refresh to update connection status
        window.location.reload();
      } else {
        throw new Error(data.message || 'Failed to connect');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Discogs. Please check your credentials.",
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
            Enter your Discogs username and personal access token to import your collection.
          </p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Discogs Username</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                placeholder="Your Discogs username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="input-discogs-username"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Personal Access Token</label>
              <input 
                type="password" 
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                placeholder="Your Discogs token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                data-testid="input-discogs-token"
              />
              <p className="text-xs text-muted-foreground">
                Get your token from: Discogs → Settings → Developer Settings → Generate Token
              </p>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleConnect}
              disabled={isConnecting || !username || !token}
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
                  Connect with Token
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
