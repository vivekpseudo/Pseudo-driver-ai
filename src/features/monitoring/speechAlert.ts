/**
 * Personalized Text-to-Speech alerts using Web SpeechSynthesis API.
 * Matches flutter_tts behavior and voice settings.
 * Includes a strict safety timeout to guarantee it never blocks execution.
 */

class SpeechAlertManager {
  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      let hasResolved = false;
      const safeResolve = () => {
        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }
      };

      // 4-second timeout to prevent any speech synthesis lockup
      const timer = setTimeout(safeResolve, 4000);

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find((v) => v.lang === 'en-IN') ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          clearTimeout(timer);
          safeResolve();
        };
        utterance.onerror = () => {
          clearTimeout(timer);
          safeResolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        clearTimeout(timer);
        safeResolve();
      }
    });
  }

  public stop(): void {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }
}

export const speechAlert = new SpeechAlertManager();
