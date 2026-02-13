// Non-blocking Play.fun SDK integration
// SDK is loaded via CDN in index.html

declare global {
  interface Window {
    OpenGameSDK: any;
    PlayFunSDK: any;
  }
}

class PlayFunIntegration {
  private sdk: any = null;
  private initialized = false;
  private pendingPoints = 0;
  private gameId: string | null = null;

  async init(gameId?: string): Promise<boolean> {
    this.gameId = gameId || null;

    // Non-blocking - if no gameId, SDK features are disabled
    if (!gameId) {
      console.log('[PlayFun] No gameId provided - running in offline mode');
      return false;
    }

    // Check if SDK is available
    const SDK = window.OpenGameSDK || window.PlayFunSDK;
    if (!SDK) {
      console.log('[PlayFun] SDK not loaded - running in offline mode');
      return false;
    }

    try {
      this.sdk = new SDK({
        gameId: gameId,
        ui: {
          usePointsWidget: true,
        },
      });

      await this.sdk.init();
      this.initialized = true;
      console.log('[PlayFun] SDK initialized successfully');

      // Flush any pending points
      if (this.pendingPoints > 0) {
        this.sdk.addPoints(this.pendingPoints);
        this.pendingPoints = 0;
      }

      return true;
    } catch (error) {
      console.log('[PlayFun] SDK init failed - running in offline mode:', error);
      return false;
    }
  }

  addPoints(points: number): void {
    if (this.initialized && this.sdk) {
      this.sdk.addPoints(points);
    } else {
      // Queue points for when SDK is ready
      this.pendingPoints += points;
    }
  }

  async savePoints(): Promise<void> {
    if (this.initialized && this.sdk) {
      try {
        await this.sdk.savePoints();
        console.log('[PlayFun] Points saved');
      } catch (error) {
        console.error('[PlayFun] Failed to save points:', error);
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export const playFun = new PlayFunIntegration();
