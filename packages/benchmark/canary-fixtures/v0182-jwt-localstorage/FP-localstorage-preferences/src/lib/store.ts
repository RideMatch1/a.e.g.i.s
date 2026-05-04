interface Prefs { sidebar: 'expanded' | 'collapsed'; pushPromptDismissed: boolean; }
export function persistPrefs(p: Prefs): void {
  localStorage.setItem('user_preferences', JSON.stringify(p));
  localStorage.setItem('push_prompt_dismissed', String(p.pushPromptDismissed));
  localStorage.setItem('sidebar_state', p.sidebar);
}
