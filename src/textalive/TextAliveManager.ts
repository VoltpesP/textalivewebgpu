/**
 * TextAlive API Integration
 * Handles lyric data and music state synchronization
 */

export interface LyricPhrase {
  startTime: number; // milliseconds
  endTime: number; // milliseconds
  text: string;
  ruby?: string; // ruby text for Japanese
  consonant?: {
    startTime: number;
    endTime: number;
    text: string;
  };
  vowel?: {
    startTime: number;
    endTime: number;
    text: string;
  };
}

export interface MusicState {
  isPlaying: boolean;
  currentTime: number; // milliseconds
  duration: number; // milliseconds
}

export class TextAliveManager {
  private phrases: LyricPhrase[] = [];
  private musicState: MusicState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  };
  private currentPhraseIndex: number = -1;

  /**
   * Initialize TextAlive with a song ID
   * The actual connection to TextAlive API should be done via their official SDK
   */
  async initializeSong(songId: string): Promise<void> {
    console.log(`TextAlive: Loading song ${songId}`);

    // TODO: Load lyrics from TextAlive API
    // Example: const data = await fetch(`https://api.textalive.jp/songs/${songId}`);
    // This requires setting up the official TextAlive SDK
  }

  /**
   * Set lyric phrases (called after loading from TextAlive API)
   */
  setPhrases(phrases: LyricPhrase[]): void {
    this.phrases = phrases;
    console.log(`TextAlive: Loaded ${phrases.length} phrases`);
  }

  /**
   * Update current music state
   */
  updateMusicState(currentTime: number, isPlaying: boolean = true): void {
    this.musicState.currentTime = currentTime;
    this.musicState.isPlaying = isPlaying;

    // Update current phrase
    this.updateCurrentPhrase();
  }

  /**
   * Update which phrase is currently active
   */
  private updateCurrentPhrase(): void {
    const currentTime = this.musicState.currentTime;

    for (let i = 0; i < this.phrases.length; i++) {
      const phrase = this.phrases[i];
      if (currentTime >= phrase.startTime && currentTime < phrase.endTime) {
        if (this.currentPhraseIndex !== i) {
          this.currentPhraseIndex = i;
        }
        return;
      }
    }

    this.currentPhraseIndex = -1;
  }

  /**
   * Get current phrase
   */
  getCurrentPhrase(): LyricPhrase | null {
    if (this.currentPhraseIndex < 0) {
      return null;
    }
    return this.phrases[this.currentPhraseIndex] || null;
  }

  /**
   * Get current phrase progress (0-1)
   */
  getCurrentPhraseProgress(): number {
    const phrase = this.getCurrentPhrase();
    if (!phrase) return 0;

    const duration = phrase.endTime - phrase.startTime;
    const elapsed = this.musicState.currentTime - phrase.startTime;
    return Math.max(0, Math.min(1, elapsed / duration));
  }

  /**
   * Get all phrases
   */
  getPhrases(): LyricPhrase[] {
    return this.phrases;
  }

  /**
   * Get phrases within a time range
   */
  getPhrasesInRange(startTime: number, endTime: number): LyricPhrase[] {
    return this.phrases.filter(
      (phrase) => phrase.startTime < endTime && phrase.endTime > startTime
    );
  }

  /**
   * Get music state
   */
  getMusicState(): MusicState {
    return { ...this.musicState };
  }

  /**
   * Get current time as percentage of total duration
   */
  getProgress(): number {
    if (this.musicState.duration === 0) return 0;
    return this.musicState.currentTime / this.musicState.duration;
  }
}
